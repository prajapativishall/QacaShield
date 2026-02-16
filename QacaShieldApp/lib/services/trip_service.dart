import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/constants.dart';

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
    final url = Uri.parse('${AppConstants.baseUrl}/trips/my-trips');
    final response = await http.get(
      url,
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else if (response.statusCode == 401 || response.statusCode == 403) {
      throw AuthException('Session expired');
    } else {
      print('Failed to load trips: ${response.statusCode} ${response.body}');
      throw Exception('Failed to load assignments: ${response.statusCode}');
    }
  }

  Future<void> sendGpsPing(int tripId, double lat, double lng) async {
    final url = Uri.parse('${AppConstants.baseUrl}/trips/gps-ping');
    await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'x-trip-id': tripId.toString(),
      },
      body: json.encode({'lat': lat, 'lng': lng}),
    );
  }

  Future<void> sendAlert(
    int tripId,
    String type,
    double lat,
    double lng,
  ) async {
    final url = Uri.parse('${AppConstants.baseUrl}/trips/alert');
    await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'trip_id': tripId,
        'type': type,
        'lat': lat,
        'lng': lng,
      }),
    );
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
    final url = Uri.parse('${AppConstants.baseUrl}/trips/accept');
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
    final url = Uri.parse('${AppConstants.baseUrl}/trips/start');
    final Map<String, dynamic> body = {'tripId': tripId};
    if (lat != null && lng != null) {
      body['lat'] = lat;
      body['lng'] = lng;
    }

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
  }

  Future<void> completeTrip(int tripId) async {
    final url = Uri.parse('${AppConstants.baseUrl}/trips/complete');
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({'tripId': tripId}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to complete assignment: ${response.body}');
    }
  }

  Future<void> reachDestination(int tripId) async {
    final url = Uri.parse('${AppConstants.baseUrl}/trips/reach-destination');
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({'tripId': tripId}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to mark arrival: ${response.body}');
    }
  }

  Future<void> startReturnTrip(int tripId, double lat, double lng) async {
    final url = Uri.parse('${AppConstants.baseUrl}/trips/return-home');
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
  }

  Future<Map<String, dynamic>> fetchOfflineSync(int tripId) async {
    final url =
        Uri.parse('${AppConstants.baseUrl}/trips/offline-sync?tripId=$tripId');
    final response = await http.get(
      url,
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception(
          'Failed to load offline route: ${response.statusCode} ${response.body}');
    }
  }
}
