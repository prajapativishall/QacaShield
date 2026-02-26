import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:location/location.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../services/trip_service.dart';
import '../config/constants.dart';
import 'safety_check_screen.dart';

class TripScreen extends StatefulWidget {
  final Map<String, dynamic> trip;

  TripScreen({required this.trip});

  @override
  _TripScreenState createState() => _TripScreenState();
}

class _TripScreenState extends State<TripScreen> {
  final MapController _mapController = MapController();
  final Location _location = Location();

  List<LatLng> _routePoints = [];
  List<Marker> _markers = [];
  LatLng? _currentLocation;
  StreamSubscription<LocationData>? _locationSubscription;

  Map<String, dynamic> _currentTrip = {};
  bool _isNavigationMode = true; // Auto-follow by default like Uber/Ola
  static const String _cachePrefix = 'trip_cache_';
  static const double _homeGeofenceRadiusMeters = 100.0;

  @override
  void initState() {
    super.initState();
    _currentTrip = widget.trip;
    _loadCachedRoute();
    _refreshTripData();
    _setupMap();
    _startTracking();
  }

  Future<void> _refreshTripData() async {
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final tripService = TripService(authService.token!);
      final trips = await tripService.fetchMyTrips();
      final updatedTrip = trips.firstWhere(
        (t) => t['id'] == widget.trip['id'],
        orElse: () => null,
      );

      if (updatedTrip != null) {
        Map<String, dynamic> merged = Map<String, dynamic>.from(updatedTrip);
        try {
          if (merged['route_polyline'] == null) {
            final offline = await tripService.fetchOfflineSync(
              widget.trip['id'],
            );
            if (offline['route_polyline'] != null) {
              merged['route_polyline'] = offline['route_polyline'];
            }
            if (offline['home_coordinates'] != null) {
              final coords = offline['home_coordinates'];
              merged['home_lat'] = coords['lat'];
              merged['home_lng'] = coords['lng'];
            }
          }
        } catch (e) {
          print("Offline sync failed: $e");
        }
        setState(() {
          _currentTrip = merged;
        });
        _setupMap();
      } else {
        // Trip not found in active list -> likely completed
        setState(() {
          _currentTrip['current_phase'] = 'COMPLETED';
          _currentTrip['active'] = false;
        });
      }
    } catch (e) {
      print("Error refreshing trip data: $e");
    }
  }

  @override
  void dispose() {
    _locationSubscription?.cancel();
    super.dispose();
  }

  double _toDouble(dynamic value) {
    if (value is double) return value;
    if (value is String) return double.tryParse(value) ?? 0.0;
    if (value is int) return value.toDouble();
    return 0.0;
  }

  Future<void> _loadCachedRoute() async {
    final prefs = await SharedPreferences.getInstance();
    final key = '$_cachePrefix${widget.trip['id']}';
    final cached = prefs.getString(key);
    if (cached == null) return;
    final data = json.decode(cached) as Map<String, dynamic>;
    final polyline = data['route_polyline'] as String?;
    if (polyline != null && polyline.isNotEmpty) {
      final points = _decodePolyline(polyline);
      if (points.isNotEmpty) {
        setState(() {
          _routePoints = points;
        });
      }
    }
    final homeLat = data['home_lat'];
    final homeLng = data['home_lng'];
    if (homeLat != null && homeLng != null) {
      if (_currentTrip['home_lat'] == null &&
          _currentTrip['home_lng'] == null) {
        _currentTrip['home_lat'] = homeLat;
        _currentTrip['home_lng'] = homeLng;
      }
    }
  }

  Future<void> _cacheRouteData() async {
    final routePolyline = _currentTrip['route_polyline'];
    if (routePolyline == null ||
        routePolyline is! String ||
        routePolyline.isEmpty) {
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final key = '$_cachePrefix${widget.trip['id']}';
    final data = <String, dynamic>{
      'route_polyline': routePolyline,
      'home_lat': _currentTrip['home_lat'],
      'home_lng': _currentTrip['home_lng'],
    };
    await prefs.setString(key, json.encode(data));
  }

  Future<void> _clearRouteCache() async {
    final prefs = await SharedPreferences.getInstance();
    final key = '$_cachePrefix${widget.trip['id']}';
    await prefs.remove(key);
  }

  Future<void> _setupMap() async {
    // Decode route if available
    if (_currentTrip['route_polyline'] != null) {
      List<LatLng> routeCoords = _decodePolyline(
        _currentTrip['route_polyline'],
      );

      if (routeCoords.isNotEmpty) {
        setState(() {
          _routePoints = routeCoords;

          // Add markers for Start and End
          _markers.clear();
          if (_currentTrip['origin_lat'] != null) {
            _markers.add(
              Marker(
                point: routeCoords.first,
                width: 80,
                height: 80,
                child: Column(
                  children: [
                    Icon(Icons.location_on, color: Colors.green, size: 40),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      color: Colors.white,
                      child: Text(
                        'Start',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          _markers.add(
            Marker(
              point: routeCoords.last,
              width: 80,
              height: 80,
              child: Column(
                children: [
                  Icon(Icons.location_on, color: Colors.red, size: 40),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    color: Colors.white,
                    child: Text(
                      'End',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        });
      }
      await _cacheRouteData();
    } else {
      // If no route yet (Planned phase), just show destination marker if available
      double? dLat = _toDouble(_currentTrip['dest_lat']);
      double? dLng = _toDouble(_currentTrip['dest_lng']);

      if (dLat != 0.0 && dLng != 0.0) {
        setState(() {
          _markers.clear();
          _markers.add(
            Marker(
              point: LatLng(dLat, dLng),
              width: 80,
              height: 80,
              child: Column(
                children: [
                  Icon(Icons.location_on, color: Colors.red, size: 40),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    color: Colors.white,
                    child: Text(
                      'Dest',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        });
      }
    }
  }

  // Helper to decode Google Polyline string to latlong2 LatLng
  List<LatLng> _decodePolyline(String encoded) {
    List<LatLng> points = [];
    int index = 0, len = encoded.length;
    int lat = 0, lng = 0;

    try {
      while (index < len) {
        int b, shift = 0, result = 0;
        do {
          if (index >= len) break;
          b = encoded.codeUnitAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
          if (index >= len) break;
          b = encoded.codeUnitAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        double finalLat = lat / 1E5;
        double finalLng = lng / 1E5;

        // Safety check to prevent map crash
        if (finalLat >= -90 &&
            finalLat <= 90 &&
            finalLng >= -180 &&
            finalLng <= 180) {
          points.add(LatLng(finalLat, finalLng));
        } else {
          print("Skipping invalid coordinate: $finalLat, $finalLng");
        }
      }
    } catch (e) {
      print("Error decoding polyline: $e");
    }
    return points;
  }

  double _distanceInMeters(LatLng a, LatLng b) {
    final dLat = _degToRad(b.latitude - a.latitude);
    final dLng = _degToRad(b.longitude - a.longitude);
    final lat1 = _degToRad(a.latitude);
    final lat2 = _degToRad(b.latitude);
    final sinDLat = math.sin(dLat / 2);
    final sinDLng = math.sin(dLng / 2);
    final aVal =
        sinDLat * sinDLat + sinDLng * sinDLng * math.cos(lat1) * math.cos(lat2);
    final c = 2 * math.atan2(math.sqrt(aVal), math.sqrt(1 - aVal));
    const earthRadius = 6371000.0;
    return earthRadius * c;
  }

  double _degToRad(double value) {
    return value * (math.pi / 180.0);
  }

  Future<void> _checkGeofenceAndComplete(LocationData currentLocation) async {
    if (_currentTrip['current_phase'] != 'RETURNING_HOME') {
      return;
    }
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      return;
    }
    final current = LatLng(
      currentLocation.latitude!,
      currentLocation.longitude!,
    );
    final homeLatVal = _toDouble(_currentTrip['home_lat']);
    final homeLngVal = _toDouble(_currentTrip['home_lng']);
    if (homeLatVal == 0.0 && homeLngVal == 0.0) {
      return;
    }
    final home = LatLng(homeLatVal, homeLngVal);
    final distance = _distanceInMeters(current, home);
    if (distance <= _homeGeofenceRadiusMeters) {
      await _completeTrip();
    }
  }

  Future<void> _startTracking() async {
    bool _serviceEnabled;
    PermissionStatus _permissionGranted;

    _serviceEnabled = await _location.serviceEnabled();
    if (!_serviceEnabled) {
      _serviceEnabled = await _location.requestService();
      if (!_serviceEnabled) return;
    }

    _permissionGranted = await _location.hasPermission();
    if (_permissionGranted == PermissionStatus.denied) {
      _permissionGranted = await _location.requestPermission();
      if (_permissionGranted != PermissionStatus.granted) return;
    }

    _location.enableBackgroundMode(
      enable: true,
    ); // Important for background tracking

    final authService = Provider.of<AuthService>(context, listen: false);
    final tripService = TripService(authService.token!);

    _locationSubscription = _location.onLocationChanged.listen((
      LocationData currentLocation,
    ) {
      if (!mounted) return;
      if (currentLocation.latitude != null &&
          currentLocation.longitude != null) {
        setState(() {
          _currentLocation = LatLng(
            currentLocation.latitude!,
            currentLocation.longitude!,
          );

          // Update My Location marker
          _markers.removeWhere(
            (m) => m.key == Key('me'),
          ); // We'll use Key to identify
          _markers.add(
            Marker(
              key: Key('me'),
              point: _currentLocation!,
              width: 60,
              height: 60,
              child: Icon(Icons.navigation, color: Colors.blueAccent, size: 40),
            ),
          );
        });

        tripService
            .sendGpsPing(
              widget.trip['id'],
              currentLocation.latitude!,
              currentLocation.longitude!,
            )
            .catchError((e) => print("Ping failed: $e"));

        if (_isNavigationMode) {
          _mapController.moveAndRotate(
            _currentLocation!,
            18.0,
            currentLocation.heading ?? 0.0,
          );
        }

        _checkGeofenceAndComplete(currentLocation);
      }
    });
  }

  void _toggleNavigationMode() {
    setState(() {
      _isNavigationMode = !_isNavigationMode;
    });
    if (_isNavigationMode && _currentLocation != null) {
      _mapController.moveAndRotate(_currentLocation!, 18.0, 0.0);
    }
  }

  Future<void> _sendSOS() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final tripService = TripService(authService.token!);

    if (_currentLocation == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Waiting for location...")));
      return;
    }

    try {
      await tripService.sendAlert(
        widget.trip['id'],
        'SOS',
        _currentLocation!.latitude,
        _currentLocation!.longitude,
      );
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text("SOS Sent", style: TextStyle(color: Colors.red)),
          content: Text("Emergency alert has been sent to HQ and Managers."),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text("OK"),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Failed to send SOS: $e")));
    }
  }

  Future<void> _completeTrip() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    try {
      await TripService(authService.token!).completeTrip(widget.trip['id']);

      if (!mounted) return;

      _locationSubscription?.cancel();
      await _location.enableBackgroundMode(enable: false);
      await _clearRouteCache();

      setState(() {
        _currentTrip['current_phase'] = 'COMPLETED';
        _currentTrip['active'] = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Assignment Completed Successfully!")),
      );
      Navigator.pop(context); // Go back to dashboard
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to complete assignment: $e")),
      );
    }
  }

  Future<void> _reachDestination() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    try {
      await TripService(authService.token!).reachDestination(widget.trip['id']);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Marked as Arrived at Destination")),
      );
      setState(() {
        _currentTrip['current_phase'] = 'REACHED_DESTINATION';
      });
      // Optionally refresh to ensure data sync
      _refreshTripData();
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Failed to mark arrival: $e")));
    }
  }

  void _triggerReturnTrip() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            SafetyCheckScreen(trip: _currentTrip, isReturnTrip: true),
      ),
    ).then((_) => _refreshTripData());
  }

  void _showLogExitDialog() {
    final TextEditingController reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Log Exit'),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(
            labelText: 'Reason for exit',
            hintText: 'e.g., Shift ended, Emergency, Personal Time',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (reasonController.text.trim().isEmpty) return;
              try {
                final authService = Provider.of<AuthService>(
                  context,
                  listen: false,
                );
                await authService.logExit(reasonController.text.trim());
                if (mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Exit logged successfully')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: $e'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text('Log Exit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _acceptTrip() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    try {
      await TripService(authService.token!).acceptTrip(widget.trip['id']);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Assignment accepted!")));
      _refreshTripData(); // Refresh to update UI to ACCEPTED state
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to accept assignment: $e")),
      );
    }
  }

  Future<void> _exitTracking() async {
    _locationSubscription?.cancel();
    await _location.enableBackgroundMode(enable: false);
    await _clearRouteCache();
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Tracking exited and route cleared")),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(
          "Assignment ID: ${widget.trip['task_title'] ?? widget.trip['id']}",
          style: TextStyle(
            color: AppConstants.secondaryColor,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        backgroundColor: Colors.white.withOpacity(0.9),
        elevation: 0,
        iconTheme: IconThemeData(color: AppConstants.secondaryColor),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: LatLng(
                _toDouble(
                  _currentTrip['origin_lat'] ??
                      _currentTrip['dest_lat'] ??
                      28.6139,
                ),
                _toDouble(
                  _currentTrip['origin_lng'] ??
                      _currentTrip['dest_lng'] ??
                      77.2090,
                ),
              ),
              initialZoom: 14.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.qaca_shield_app',
              ),
              if (_routePoints.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: _routePoints,
                      strokeWidth: 5.0,
                      color: AppConstants.primaryColor,
                    ),
                  ],
                ),
              MarkerLayer(markers: _markers),
              RichAttributionWidget(
                attributions: [
                  TextSourceAttribution(
                    'OpenStreetMap contributors',
                    onTap: () {}, // Add action if needed
                  ),
                ],
              ),
            ],
          ),

          // SOS Button (Top Right)
          Positioned(
            top: MediaQuery.of(context).padding.top + kToolbarHeight + 16,
            right: 16,
            child: Column(
              children: [
                FloatingActionButton(
                  heroTag: "sos_btn",
                  onPressed: _sendSOS,
                  backgroundColor: Colors.red,
                  child: Icon(Icons.sos, color: Colors.white, size: 30),
                  elevation: 4,
                ),
                SizedBox(height: 16),
                FloatingActionButton(
                  heroTag: "nav_btn",
                  onPressed: _toggleNavigationMode,
                  backgroundColor: _isNavigationMode
                      ? Colors.blue
                      : Colors.white,
                  child: Icon(
                    _isNavigationMode ? Icons.navigation : Icons.my_location,
                    color: _isNavigationMode ? Colors.white : Colors.blue,
                    size: 30,
                  ),
                  elevation: 4,
                ),
              ],
            ),
          ),

          // Bottom Info Panel
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 10,
                    offset: Offset(0, -2),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppConstants.primaryColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.location_on,
                          color: AppConstants.primaryColor,
                        ),
                      ),
                      SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Destination",
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              _currentTrip['destination_address'] ??
                                  (_currentTrip['dest_lat'] != null &&
                                          _currentTrip['dest_lng'] != null
                                      ? "${_currentTrip['dest_lat']}, ${_currentTrip['dest_lng']}"
                                      : "Unknown Destination"),
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 20),
                  if ((_currentTrip['current_phase'] == 'PENDING' ||
                          _currentTrip['current_phase'] == 'PLANNED') &&
                      !_currentTrip['active'])
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _acceptTrip,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          padding: EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          "Accept Assignment",
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    )
                  else if (_currentTrip['current_phase'] == 'ACCEPTED' &&
                      !_currentTrip['active'])
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  SafetyCheckScreen(trip: _currentTrip),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppConstants.primaryColor,
                          padding: EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          "Start Assignment",
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    )
                  else
                    Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildStatusChip(
                              Icons.speed,
                              "On Time", // Placeholder logic
                              Colors.blue,
                            ),
                            _buildStatusChip(
                              Icons.shield,
                              "Protected",
                              Colors.green,
                            ),
                            _buildStatusChip(
                              Icons.battery_std,
                              "Tracking",
                              AppConstants.primaryColor,
                            ),
                          ],
                        ),
                        SizedBox(height: 16),
                        if (_currentTrip['active'])
                          Column(
                            children: [
                              if (_currentTrip['current_phase'] == 'ACTIVE' ||
                                  _currentTrip['current_phase'] == null)
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: _reachDestination,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.blueAccent,
                                      padding: EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: Text(
                                      "Reached Destination",
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                )
                              else if (_currentTrip['current_phase'] ==
                                  'REACHED_DESTINATION')
                                Column(
                                  children: [
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton(
                                        onPressed: _triggerReturnTrip,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor:
                                              AppConstants.primaryColor,
                                          padding: EdgeInsets.symmetric(
                                            vertical: 16,
                                          ),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                        ),
                                        child: Text(
                                          "Start Return Trip",
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                    ),
                                    SizedBox(height: 12),
                                    SizedBox(
                                      width: double.infinity,
                                      child: OutlinedButton.icon(
                                        onPressed: _showLogExitDialog,
                                        icon: Icon(
                                          Icons.exit_to_app,
                                          color: Colors.red,
                                        ),
                                        label: Text(
                                          "Log Exit (Personal Time)",
                                          style: TextStyle(color: Colors.red),
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          padding: EdgeInsets.symmetric(
                                            vertical: 16,
                                          ),
                                          side: BorderSide(color: Colors.red),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                )
                            ],
                          ),
                        if (_currentTrip['active'])
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: _exitTracking,
                              style: OutlinedButton.styleFrom(
                                padding: EdgeInsets.symmetric(vertical: 14),
                                side: BorderSide(color: Colors.black54),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: Text(
                                "Exit Tracking",
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                          )
                        else
                          Container(
                            width: double.infinity,
                            padding: EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade200,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade400),
                            ),
                            child: Center(
                              child: Text(
                                "Assignment Completed",
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChip(IconData icon, String label, Color color) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
