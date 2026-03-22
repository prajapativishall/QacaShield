import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:location/location.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';
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

class _TripScreenState extends State<TripScreen>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  final Location _location = Location();
  AnimationController? _animationController;

  List<LatLng> _routePoints = [];
  List<LatLng> _routeAheadPoints = [];
  int _offRouteHits = 0;
  static const double _offRouteThresholdMeters = 120.0;
  static const int _offRouteConfirmHits = 3;
  List<Marker> _markers = [];
  LatLng? _currentLocation;
  double _currentHeading = 0.0;
  StreamSubscription<LocationData>? _locationSubscription;

  Map<String, dynamic> _currentTrip = {};
  bool _isNavigationMode = true; // Auto-follow by default like Uber/Ola
  static const String _cachePrefix = 'trip_cache_';
  static const double _homeGeofenceRadiusMeters = 100.0;
  bool _arrivalInProgress = false;
  TileProvider? _tileProvider;
  DateTime? _tripStartTime;

  void _animatedMapMove(
    LatLng destLocation,
    double? destZoom,
    double destRotation,
  ) {
    _animationController?.stop();
    _animationController?.dispose();

    final targetZoom = destZoom ?? _mapController.camera.zoom;

    final latTween = Tween<double>(
      begin: _mapController.camera.center.latitude,
      end: destLocation.latitude,
    );
    final lngTween = Tween<double>(
      begin: _mapController.camera.center.longitude,
      end: destLocation.longitude,
    );
    final zoomTween = Tween<double>(
      begin: _mapController.camera.zoom,
      end: targetZoom,
    );
    final rotationTween = Tween<double>(
      begin: _mapController.camera.rotation,
      end: destRotation,
    );

    _animationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );

    final animation = CurvedAnimation(
      parent: _animationController!,
      curve: Curves.fastOutSlowIn,
    );

    _animationController!.addListener(() {
      if (!mounted) return;
      _mapController.moveAndRotate(
        LatLng(latTween.evaluate(animation), lngTween.evaluate(animation)),
        zoomTween.evaluate(animation),
        rotationTween.evaluate(animation),
      );
    });

    _animationController!.forward();
  }

  @override
  void dispose() {
    _animationController?.dispose();
    _locationSubscription?.cancel();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _tripStartTime = DateTime.now();
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
        // Trip not found in active list -> likely completed or cancelled
        // But only if we are online and sure it's gone
        setState(() {
          _currentTrip['current_phase'] = 'COMPLETED';
          _currentTrip['active'] = false;
        });
      }
    } catch (e) {
      print("Error refreshing trip data (offline?): $e");
      // If offline, we keep using the data we have from widget.trip or _loadCachedRoute
    }
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
    if (_currentTrip['route_polyline'] != null ||
        _currentTrip['route_path'] != null) {
      List<LatLng> routeCoords = _decodePolyline(
        _currentTrip['route_polyline'] ?? '',
      );
      if (routeCoords.isEmpty && _currentTrip['route_path'] != null) {
        try {
          final List<dynamic> raw = _currentTrip['route_path'];
          routeCoords = raw
              .map((p) => LatLng(_toDouble(p[0]), _toDouble(p[1])))
              .toList();
        } catch (_) {}
      }

      if (routeCoords.isNotEmpty) {
        setState(() {
          _routePoints = routeCoords;
          _routeAheadPoints = routeCoords;

          // Add markers for Start and End
          // Preserve 'me' marker if exists
          Marker? meMarker;
          try {
            meMarker = _markers.firstWhere((m) => m.key == Key('me'));
          } catch (_) {}

          _markers.clear();
          if (meMarker != null) _markers.add(meMarker);

          final oLat = _toDouble(_currentTrip['origin_lat']);
          final oLng = _toDouble(_currentTrip['origin_lng']);
          final startPoint = (oLat != 0.0 && oLng != 0.0)
              ? LatLng(oLat, oLng)
              : routeCoords.first;

          _markers.add(
            Marker(
              point: startPoint,
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

          final dLat = _toDouble(_currentTrip['dest_lat']);
          final dLng = _toDouble(_currentTrip['dest_lng']);
          final endPoint = (dLat != 0.0 && dLng != 0.0)
              ? LatLng(dLat, dLng)
              : routeCoords.last;

          _markers.add(
            Marker(
              point: endPoint,
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
      double dLat = _toDouble(_currentTrip['dest_lat']);
      double dLng = _toDouble(_currentTrip['dest_lng']);

      if (dLat != 0.0 && dLng != 0.0) {
        setState(() {
          Marker? meMarker;
          try {
            meMarker = _markers.firstWhere((m) => m.key == Key('me'));
          } catch (_) {}

          _markers.clear();
          if (meMarker != null) _markers.add(meMarker);

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
    try {
      final storeName = 'trip_${_currentTrip['id']}';
      final store = FMTCStore(storeName);
      await store.manage.create();
      setState(() {
        _tileProvider = FMTCTileProvider(
          stores: {storeName: BrowseStoreStrategy.readUpdateCreate},
          loadingStrategy: BrowseLoadingStrategy.cacheFirst,
        );
      });
    } catch (e) {
      print("Offline map setup failed: $e");
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

  int? _nearestRouteIndex(LatLng current) {
    if (_routePoints.isEmpty) return null;
    double best = double.infinity;
    int bestIdx = 0;
    for (int i = 0; i < _routePoints.length; i++) {
      final d = _distanceInMeters(current, _routePoints[i]);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  Future<void> _rerouteFromCurrent() async {
    final dLat = _toDouble(_currentTrip['dest_lat']);
    final dLng = _toDouble(_currentTrip['dest_lng']);
    if (_currentLocation == null || dLat == 0.0 || dLng == 0.0) return;

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final ts = TripService(authService.token!);
      final newPath = await ts.fetchBestRoute(
        _currentLocation!.latitude,
        _currentLocation!.longitude,
        dLat,
        dLng,
      );
      final coords = newPath.map((p) => LatLng(p[0], p[1])).toList();
      if (coords.isNotEmpty) {
        setState(() {
          _routePoints = coords;
          _routeAheadPoints = coords;
          _currentTrip['route_path'] = newPath;
        });
        await _setupMap();
        await _cacheRouteData();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Route updated")));
      }
    } catch (e) {
      // Offline Reroute Fallback: Straight line from current location to destination
      final fallbackPoints = [_currentLocation!, LatLng(dLat, dLng)];
      setState(() {
        _routePoints = fallbackPoints;
        _routeAheadPoints = fallbackPoints;
        _currentTrip['route_path'] = [
          [_currentLocation!.latitude, _currentLocation!.longitude],
          [dLat, dLng],
        ];
      });
      // Refresh markers to ensure current location and destination are shown correctly
      await _setupMap();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Offline: Using direct path to destination"),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _checkGeofenceAndComplete(LocationData currentLocation) async {
    if (_currentTrip['current_phase'] != 'RETURNING_HOME') {
      return;
    }
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      return;
    }
    // Prevent triggering if location is (0,0) (initialization error)
    if (currentLocation.latitude == 0.0 && currentLocation.longitude == 0.0) {
      return;
    }
    final current = LatLng(
      currentLocation.latitude!,
      currentLocation.longitude!,
    );
    final homeLatVal = _toDouble(_currentTrip['home_lat']);
    final homeLngVal = _toDouble(_currentTrip['home_lng']);

    // Debug Logging
    print(
      "RETURN GEOFENCE: Current(${current.latitude}, ${current.longitude}) Home($homeLatVal, $homeLngVal)",
    );

    if (homeLatVal == 0.0 && homeLngVal == 0.0) {
      print("RETURN GEOFENCE: Missing home coordinates, skipping.");
      return;
    }
    // Safeguard: Wait at least 30 seconds after starting the return trip before allowing completion
    if (_tripStartTime != null &&
        DateTime.now().difference(_tripStartTime!).inSeconds < 30) {
      return;
    }

    final home = LatLng(homeLatVal, homeLngVal);
    final distance = _distanceInMeters(current, home);
    print("RETURN GEOFENCE: Distance = $distance meters");

    if (distance <= _homeGeofenceRadiusMeters) {
      print("RETURN GEOFENCE: Home REACHED! Finalizing assignment...");
      await _completeTrip();
    }
  }

  Future<void> _checkDestinationGeofence(LocationData currentLocation) async {
    if (_currentTrip['current_phase'] != 'ACTIVE') {
      return;
    }
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      return;
    }
    // Prevent triggering if location is (0,0) (initialization error)
    if (currentLocation.latitude == 0.0 && currentLocation.longitude == 0.0) {
      return;
    }
    // Safeguard: Wait at least 30 seconds after starting the trip before allowing destination arrival
    if (_tripStartTime != null &&
        DateTime.now().difference(_tripStartTime!).inSeconds < 30) {
      return;
    }
    if (_arrivalInProgress) {
      return;
    }
    final current = LatLng(
      currentLocation.latitude!,
      currentLocation.longitude!,
    );
    final destLatVal = _toDouble(_currentTrip['dest_lat']);
    final destLngVal = _toDouble(_currentTrip['dest_lng']);

    // Debug Logging
    print(
      "GEOFENCE CHECK: Current(${current.latitude}, ${current.longitude}) Dest($destLatVal, $destLngVal)",
    );

    if (destLatVal == 0.0 && destLngVal == 0.0) {
      print("GEOFENCE: Missing destination coordinates, skipping.");
      return;
    }
    final dest = LatLng(destLatVal, destLngVal);
    // Also skip if the destination is exactly the same as origin (start of trip)
    final originLat = _toDouble(_currentTrip['origin_lat']);
    final originLng = _toDouble(_currentTrip['origin_lng']);
    if (originLat != 0.0 &&
        originLng != 0.0 &&
        _distanceInMeters(current, LatLng(originLat, originLng)) < 100.0) {
      // Still within 100m of starting point, don't trigger destination reached
      print("GEOFENCE: Too close to origin, skipping.");
      return;
    }

    double radius = 100.0;
    final rawRadius = _currentTrip['geofence_radius'];
    if (rawRadius != null) {
      final r = _toDouble(rawRadius);
      if (r > 0) radius = r;
    }
    if (radius < 10.0) radius = 10.0;
    final distance = _distanceInMeters(current, dest);
    print("GEOFENCE: Calculated distance = $distance meters (Radius: $radius)");

    if (distance <= radius) {
      print("GEOFENCE: Destination REACHED! Triggering arrival...");
      _arrivalInProgress = true;
      try {
        final ok = await _reachDestination();
        if (!ok) {
          _arrivalInProgress = false;
        }
      } finally {
        if (mounted && _currentTrip['current_phase'] != 'REACHED_DESTINATION') {
          _arrivalInProgress = false;
        }
      }
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

    _location.changeSettings(
      accuracy: LocationAccuracy.high,
      interval: 5000, // 5 seconds
      distanceFilter: 10, // 10 meters
    );

    final authService = Provider.of<AuthService>(context, listen: false);
    final tripService = TripService(authService.token!);
    await tripService.flushPendingEvents();

    _locationSubscription = _location.onLocationChanged.listen((
      LocationData currentLocationData,
    ) {
      if (!mounted) return;
      if (currentLocationData.latitude != null &&
          currentLocationData.longitude != null) {
        final rawLocation = LatLng(
          currentLocationData.latitude!,
          currentLocationData.longitude!,
        );

        LatLng snappedLocation = rawLocation;
        int? nearestIdx;

        // 1. Snapping: If close to the route, snap the icon to the line
        if (_routePoints.isNotEmpty) {
          nearestIdx = _nearestRouteIndex(rawLocation);
          if (nearestIdx != null && nearestIdx >= 0) {
            final nearestPoint = _routePoints[nearestIdx];
            final dist = _distanceInMeters(rawLocation, nearestPoint);
            if (dist <= 15.0) {
              // Within 15m: Snap for visual smoothness
              snappedLocation = nearestPoint;
            }
          }
        }

        // 2. Heading Filtering: Ignore noisy jumps when stationary
        double newHeading = _currentHeading;
        final speed = (currentLocationData.speed ?? 0.0) * 3.6; // Speed in km/h
        if (speed > 5.0 && currentLocationData.heading != null) {
          // Only update heading if moving fast enough to be accurate
          newHeading = currentLocationData.heading!;
        }

        setState(() {
          _currentLocation = snappedLocation;
          _currentHeading = newHeading;

          // Update My Location marker (Motorcycle Icon)
          _markers.removeWhere((m) => m.key == Key('me'));
          _markers.add(
            Marker(
              key: Key('me'),
              point: snappedLocation,
              width: 60,
              height: 60,
              child: Transform.rotate(
                angle: (_currentHeading * math.pi) / 180.0,
                child: Icon(
                  Icons.motorcycle,
                  color: Colors.blueAccent,
                  size: 40,
                ),
              ),
            ),
          );

          // 3. Route Trail: Keep a bit of history (last 2 points) for visual context
          if (nearestIdx != null && nearestIdx >= 0) {
            final startIdx = math.max(0, nearestIdx - 2);
            _routeAheadPoints = _routePoints.sublist(startIdx);

            final distToRoute = _distanceInMeters(
              rawLocation,
              _routePoints[nearestIdx],
            );
            if (distToRoute <= 50.0) {
              _offRouteHits = 0;
            } else {
              _offRouteHits += 1;
              if (_offRouteHits >= _offRouteConfirmHits &&
                  distToRoute > _offRouteThresholdMeters) {
                _offRouteHits = 0;
                _rerouteFromCurrent();
              }
            }
          }
        });

        // 4. Background Server Ping
        tripService
            .sendGpsPing(
              widget.trip['id'],
              currentLocationData.latitude!,
              currentLocationData.longitude!,
            )
            .catchError((e) => print("Ping failed: $e"));

        // 5. Camera Animation (Navigation Mode)
        if (_isNavigationMode && _currentLocation != null) {
          final currentZoom = _mapController.camera.zoom;
          final targetZoom = currentZoom < 14.0 ? 18.0 : currentZoom;
          _animatedMapMove(_currentLocation!, targetZoom, _currentHeading);
        }

        _checkGeofenceAndComplete(currentLocationData);
        _checkDestinationGeofence(currentLocationData);
      }
    });
  }

  void _toggleNavigationMode() {
    setState(() {
      _isNavigationMode = !_isNavigationMode;
    });
    if (_isNavigationMode && _currentLocation != null) {
      final currentZoom = _mapController.camera.zoom;
      final targetZoom = currentZoom < 14.0 ? 18.0 : currentZoom;
      _animatedMapMove(_currentLocation!, targetZoom, 0.0);
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

      // Determine if it was truly a network error
      final errorStr = e.toString().toLowerCase();
      final isNetworkError =
          errorStr.contains('socketexception') ||
          errorStr.contains('httpexception') ||
          errorStr.contains('handshakeexception') ||
          errorStr.contains('timeout');

      if (isNetworkError) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: Text("SOS Recorded", style: TextStyle(color: Colors.orange)),
            content: Text(
              "You are offline. The SOS alert has been recorded and will be sent automatically once you are back online.",
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text("OK"),
              ),
            ],
          ),
        );
      } else {
        // It was a server-side error or something else, but we were online
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Failed to send SOS: $e")));
      }
    }
  }

  Future<void> _completeTrip() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final lat = _currentLocation?.latitude;
    final lng = _currentLocation?.longitude;
    try {
      await TripService(
        authService.token!,
      ).completeTrip(widget.trip['id'], lat: lat, lng: lng);

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
      if (mounted) {
        _locationSubscription?.cancel();
        await _location.enableBackgroundMode(enable: false);
        await _clearRouteCache();
        setState(() {
          _currentTrip['current_phase'] = 'COMPLETED';
          _currentTrip['active'] = false;
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Completion recorded offline")));
        Navigator.pop(context);
      }
    }
    try {
      final storeName = 'trip_${_currentTrip['id']}';
      final store = FMTCStore(storeName);
      await store.manage.delete();
    } catch (_) {}
  }

  Future<bool> _reachDestination() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final lat = _currentLocation?.latitude;
    final lng = _currentLocation?.longitude;
    try {
      await TripService(
        authService.token!,
      ).reachDestination(_currentTrip['id'], lat: lat, lng: lng);
      if (!mounted) return true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Marked as Arrived at Destination")),
      );
      setState(() {
        _currentTrip['current_phase'] = 'REACHED_DESTINATION';
      });
      _refreshTripData();
      return true;
    } catch (e) {
      if (mounted) {
        setState(() {
          _currentTrip['current_phase'] = 'REACHED_DESTINATION';
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Arrival recorded offline")));
      }
      return false;
    }
  }

  void _triggerReturnTrip() {
    _tripStartTime = DateTime.now();
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
                final tripService = TripService(authService.token!);
                final reason = reasonController.text.trim();
                await tripService.earlyExitTrip(
                  _currentTrip['id'],
                  reason,
                  lat: _currentLocation?.latitude,
                  lng: _currentLocation?.longitude,
                );
                await authService.logExit(reason);
                if (mounted) {
                  Navigator.pop(context);
                  await _exitTracking();
                  setState(() {
                    _currentTrip['current_phase'] = 'COMPLETED';
                    _currentTrip['active'] = false;
                    _currentTrip['exit_reason'] = reason;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Assignment marked as Early Exit')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  final authService2 = Provider.of<AuthService>(
                    context,
                    listen: false,
                  );
                  await TripService(authService2.token!).enqueueEvent({
                    'type': 'early_exit',
                    'tripId': _currentTrip['id'],
                    'reason': reasonController.text.trim(),
                    'lat': _currentLocation?.latitude,
                    'lng': _currentLocation?.longitude,
                    'ts': DateTime.now().toIso8601String(),
                  });
                  Navigator.pop(context);
                  await _exitTracking();
                  setState(() {
                    _currentTrip['current_phase'] = 'COMPLETED';
                    _currentTrip['active'] = false;
                    _currentTrip['exit_reason'] = reasonController.text.trim();
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Exit recorded offline')),
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
              initialZoom: 16.0,
              onMapEvent: (event) {
                if (event is MapEventMoveStart &&
                    event.source != MapEventSource.mapController) {
                  if (_isNavigationMode) {
                    setState(() {
                      _isNavigationMode = false;
                    });
                  }
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.qaca_shield_app',
                tileProvider: _tileProvider ?? NetworkTileProvider(),
              ),
              if (_routeAheadPoints.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: _routeAheadPoints,
                      strokeWidth: 5.0,
                      color: AppConstants.primaryColor,
                    ),
                  ],
                ),
              CircleLayer(
                circles: [
                  // Destination Geofence
                  if (_currentTrip['current_phase'] == 'ACTIVE' &&
                      _currentTrip['dest_lat'] != null &&
                      _currentTrip['dest_lng'] != null)
                    CircleMarker(
                      point: LatLng(
                        _toDouble(_currentTrip['dest_lat']),
                        _toDouble(_currentTrip['dest_lng']),
                      ),
                      radius: _toDouble(_currentTrip['geofence_radius'] ?? 100),
                      useRadiusInMeter: true,
                      color: Colors.blue.withOpacity(0.15),
                      borderColor: Colors.blue.withOpacity(0.5),
                      borderStrokeWidth: 2,
                    ),
                  // Home Geofence (during return trip)
                  if (_currentTrip['current_phase'] == 'RETURNING_HOME' &&
                      _currentTrip['home_lat'] != null &&
                      _currentTrip['home_lng'] != null)
                    CircleMarker(
                      point: LatLng(
                        _toDouble(_currentTrip['home_lat']),
                        _toDouble(_currentTrip['home_lng']),
                      ),
                      radius: _homeGeofenceRadiusMeters,
                      useRadiusInMeter: true,
                      color: Colors.green.withOpacity(0.15),
                      borderColor: Colors.green.withOpacity(0.5),
                      borderStrokeWidth: 2,
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
                      ? AppConstants.primaryColor
                      : Colors.white,
                  child: Icon(
                    _isNavigationMode ? Icons.navigation : Icons.my_location,
                    color: _isNavigationMode
                        ? Colors.white
                        : AppConstants.primaryColor,
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
                              if (_currentTrip['current_phase'] ==
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
                                ),
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
