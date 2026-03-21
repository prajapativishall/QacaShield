import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/constants.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthException implements Exception {
  final String message;
  AuthException(this.message);
  @override
  String toString() => message;
}

class TripService {
  final String token;

  TripService(this.token);

  Future<List<dynamic>> fetchMyTrips() async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/my-trips');
    final prefs = await SharedPreferences.getInstance();

    try {
      final response = await http.get(
        url,
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        await prefs.setString('cached_my_trips', response.body);
        return data;
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        throw AuthException('Session expired');
      } else {
        print('Failed to load trips: ${response.statusCode} ${response.body}');
        throw Exception('Failed to load assignments: ${response.statusCode}');
      }
    } catch (e) {
      if (e is AuthException) rethrow;

      // Offline: Try to load from cache
      final cached = prefs.getString('cached_my_trips');
      if (cached != null) {
        print('Offline: Loading trips from cache');
        return json.decode(cached);
      }
      rethrow;
    }
  }

  Future<List<dynamic>> fetchMyCompletedTrips() async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/my-completed');
    final response = await http.get(
      url,
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else if (response.statusCode == 401 || response.statusCode == 403) {
      throw AuthException('Session expired');
    } else {
      print(
        'Failed to load completed trips: ${response.statusCode} ${response.body}',
      );
      throw Exception(
        'Failed to load completed assignments: ${response.statusCode}',
      );
    }
  }

  Future<List<dynamic>> fetchMyHistory({int? year, int? month}) async {
    final query = <String, String>{};
    if (year != null) query['year'] = year.toString();
    if (month != null) query['month'] = month.toString();
    final url = Uri.parse(
      '${AppConstants.baseUrl}/assignments/my-history',
    ).replace(queryParameters: query.isEmpty ? null : query);
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = 'cached_history_${year}_$month';

    try {
      final response = await http.get(
        url,
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        await prefs.setString(cacheKey, response.body);
        return data;
      } else if (response.statusCode == 404) {
        return await fetchMyCompletedTrips();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        throw AuthException('Session expired');
      } else {
        print(
          'Failed to load history: ${response.statusCode} ${response.body}',
        );
        throw Exception('Failed to load assignment history');
      }
    } catch (e) {
      if (e is AuthException) rethrow;
      final cached = prefs.getString(cacheKey);
      if (cached != null) {
        print('Offline: Loading history from cache');
        return json.decode(cached);
      }
      rethrow;
    }
  }

  Future<void> sendGpsPing(
    int tripId,
    double lat,
    double lng, {
    bool isFlushing = false,
  }) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/gps-ping');
    try {
      final response = await http
          .post(
            url,
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
              'x-trip-id': tripId.toString(),
            },
            body: json.encode({'lat': lat, 'lng': lng}),
          )
          .timeout(Duration(seconds: 5));

      if (response.statusCode == 200) {
        if (!isFlushing) await flushPendingEvents();
      } else {
        throw Exception('Ping failed: ${response.statusCode}');
      }
    } catch (_) {
      // Offline: Enqueue for later (only if not already flushing)
      if (!isFlushing) {
        await enqueueEvent({
          'type': 'gps_ping',
          'tripId': tripId,
          'lat': lat,
          'lng': lng,
          'ts': DateTime.now().toIso8601String(),
        });
      } else {
        rethrow; // Rethrow to keep it in the remaining list
      }
    }
  }

  Future<void> sendAlert(
    int tripId,
    String type,
    double lat,
    double lng, {
    bool isFlushing = false,
  }) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/alert');
    try {
      final response = await http
          .post(
            url,
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'assignment_id': tripId,
              'type': type,
              'lat': lat,
              'lng': lng,
            }),
          )
          .timeout(Duration(seconds: 10));

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('Alert failed: ${response.statusCode}');
      }
    } catch (e) {
      // Offline: Enqueue for later (only if not already flushing)
      if (!isFlushing) {
        await enqueueEvent({
          'type': 'alert',
          'tripId': tripId,
          'alertType': type,
          'lat': lat,
          'lng': lng,
          'ts': DateTime.now().toIso8601String(),
        });
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> uploadSafetyCheck(
    int tripId,
    String filePath,
    Map<String, bool> checklist, {
    Uint8List? fileBytes,
  }) async {
    final url = Uri.parse('${AppConstants.baseUrl}/safety/upload');
    var request = http.MultipartRequest('POST', url);

    request.headers['Authorization'] = 'Bearer $token';
    request.fields['tripId'] = tripId.toString();
    // Serialize checklist if needed, or just send keys
    request.fields['checklist'] = json.encode(checklist);

    if (fileBytes != null) {
      request.files.add(
        http.MultipartFile.fromBytes(
          'helmet_image',
          fileBytes,
          filename: 'helmet.jpg',
          contentType: MediaType('image', 'jpeg'),
        ),
      );
    } else {
      request.files.add(
        await http.MultipartFile.fromPath(
          'helmet_image',
          filePath,
          contentType: MediaType('image', 'jpeg'),
        ),
      );
    }

    var response = await request.send();

    if (response.statusCode != 200) {
      final respStr = await response.stream.bytesToString();
      try {
        final respJson = json.decode(respStr);
        throw Exception(respJson['error'] ?? 'Safety check upload failed');
      } catch (e) {
        if (e is FormatException) {
          throw Exception('Safety check upload failed: ${response.statusCode}');
        }
        rethrow;
      }
    }

    // Return response data for verification details
    final respStr = await response.stream.bytesToString();
    if (respStr.isNotEmpty) {
      return json.decode(respStr);
    }
    return {};
  }

  Future<void> acceptTrip(int tripId) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/accept');
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({'tripId': tripId}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to accept assignment: ${response.body}');
    }
  }

  Future<void> startTrip(int tripId, {double? lat, double? lng}) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/start');
    final Map<String, dynamic> body = {'tripId': tripId};
    if (lat != null && lng != null) {
      body['lat'] = lat;
      body['lng'] = lng;
    }

    try {
      final response = await http.post(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(body),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to start assignment: ${response.body}');
      }
    } catch (e) {
      // Offline: Enqueue for later
      await enqueueEvent({
        'type': 'start_trip',
        'tripId': tripId,
        'lat': lat,
        'lng': lng,
        'ts': DateTime.now().toIso8601String(),
      });
      rethrow;
    }
  }

  Future<void> completeTrip(int tripId, {double? lat, double? lng}) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/complete');
    final Map<String, dynamic> body = {'tripId': tripId};
    if (lat != null && lng != null) {
      body['lat'] = lat;
      body['lng'] = lng;
    }

    try {
      final response = await http.post(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(body),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to complete assignment: ${response.body}');
      }
    } catch (e) {
      // Offline: Enqueue for later
      await enqueueEvent({
        'type': 'complete_trip',
        'tripId': tripId,
        'lat': lat,
        'lng': lng,
        'ts': DateTime.now().toIso8601String(),
      });
      rethrow;
    }
  }

  Future<void> reachDestination(int tripId, {double? lat, double? lng}) async {
    final url = Uri.parse(
      '${AppConstants.baseUrl}/assignments/reach-destination',
    );
    final Map<String, dynamic> body = {'tripId': tripId};
    if (lat != null && lng != null) {
      body['lat'] = lat;
      body['lng'] = lng;
    }

    try {
      final response = await http.post(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(body),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to reach destination: ${response.body}');
      }
    } catch (e) {
      // Offline: Enqueue for later
      await enqueueEvent({
        'type': 'reach_destination',
        'tripId': tripId,
        'lat': lat,
        'lng': lng,
        'ts': DateTime.now().toIso8601String(),
      });
      rethrow;
    }
  }

  Future<void> earlyExitTrip(
    int tripId,
    String reason, {
    double? lat,
    double? lng,
  }) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/early-exit');
    final Map<String, dynamic> body = {'tripId': tripId, 'reason': reason};
    if (lat != null && lng != null) {
      body['lat'] = lat;
      body['lng'] = lng;
    }

    try {
      final response = await http.post(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(body),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to mark early exit: ${response.body}');
      }
    } catch (e) {
      // Offline: Enqueue for later
      await enqueueEvent({
        'type': 'early_exit',
        'tripId': tripId,
        'reason': reason,
        'lat': lat,
        'lng': lng,
        'ts': DateTime.now().toIso8601String(),
      });
      rethrow;
    }
  }

  Future<void> startReturnTrip(int tripId, double lat, double lng) async {
    final url = Uri.parse('${AppConstants.baseUrl}/assignments/return-home');
    try {
      final response = await http.post(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode({'tripId': tripId, 'lat': lat, 'lng': lng}),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to start return trip: ${response.body}');
      }
    } catch (e) {
      // Offline: Enqueue for later
      await enqueueEvent({
        'type': 'start_return',
        'tripId': tripId,
        'lat': lat,
        'lng': lng,
        'ts': DateTime.now().toIso8601String(),
      });
      rethrow;
    }
  }

  Future<Map<String, dynamic>> fetchOfflineSync(int tripId) async {
    final url = Uri.parse(
      '${AppConstants.baseUrl}/assignments/offline-sync?tripId=$tripId',
    );
    final response = await http.get(
      url,
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception(
        'Failed to load offline route: ${response.statusCode} ${response.body}',
      );
    }
  }

  Future<List<List<double>>> fetchBestRoute(
    double originLat,
    double originLng,
    double destLat,
    double destLng,
  ) async {
    final origin = '$originLat,$originLng';
    final destination = '$destLat,$destLng';
    final url = Uri.parse(
      '${AppConstants.baseUrl}/trips/best-route?origin=$origin&destination=$destination',
    );
    final response = await http.get(
      url,
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is Map && data['route_path'] is List) {
        final List<dynamic> raw = data['route_path'];
        return raw.map<List<double>>((p) => [p[0] * 1.0, p[1] * 1.0]).toList();
      }
      throw Exception('Route response missing route_path');
    } else {
      throw Exception('Failed to fetch route: ${response.statusCode}');
    }
  }

  Future<void> enqueueEvent(Map<String, dynamic> event) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('pending_events') ?? '[]';
    final list = (json.decode(raw) as List).cast<dynamic>().toList();
    list.add(event);
    await prefs.setString('pending_events', json.encode(list));
  }

  Future<void> flushPendingEvents() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('pending_events') ?? '[]';
    List<dynamic> list = (json.decode(raw) as List).cast<dynamic>().toList();
    if (list.isEmpty) return;
    final remaining = <dynamic>[];
    for (final e in list) {
      try {
        final m = Map<String, dynamic>.from(e as Map);
        final type = (m['type'] ?? '').toString();
        if (type == 'reach_destination') {
          await reachDestination(m['tripId'], lat: m['lat'], lng: m['lng']);
        } else if (type == 'complete_trip') {
          await completeTrip(m['tripId'], lat: m['lat'], lng: m['lng']);
        } else if (type == 'gps_ping') {
          await sendGpsPing(m['tripId'], m['lat'], m['lng'], isFlushing: true);
        } else if (type == 'safety_check') {
          final Map<String, bool> checklist = Map<String, bool>.from(
            m['checklist'] as Map,
          );
          await uploadSafetyCheck(m['tripId'], m['filePath'], checklist);
        } else if (type == 'early_exit') {
          await earlyExitTrip(
            m['tripId'],
            m['reason'] ?? '',
            lat: m['lat'],
            lng: m['lng'],
          );
        } else if (type == 'start_return') {
          await startReturnTrip(m['tripId'], m['lat'], m['lng']);
        } else if (type == 'start_trip') {
          await startTrip(m['tripId'], lat: m['lat'], lng: m['lng']);
        } else if (type == 'alert') {
          await sendAlert(
            m['tripId'],
            m['alertType'],
            m['lat'],
            m['lng'],
            isFlushing: true,
          );
        } else {
          remaining.add(e);
        }
      } catch (_) {
        remaining.add(e);
      }
    }
    await prefs.setString('pending_events', json.encode(remaining));
  }
}
