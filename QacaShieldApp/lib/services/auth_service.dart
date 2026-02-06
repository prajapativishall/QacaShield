import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../config/constants.dart';

class AuthService with ChangeNotifier {
  String? _token;
  Map<String, dynamic>? _user;

  bool get isAuthenticated => _token != null;
  String? get token => _token;
  Map<String, dynamic>? get user => _user;

  Future<bool> tryAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    if (!prefs.containsKey('token')) return false;

    _token = prefs.getString('token');
    final userData = prefs.getString('user');
    if (userData != null) {
      _user = json.decode(userData);
    }
    notifyListeners();
    return true;
  }

  Future<void> login(String employeeId, String password) async {
    final url = Uri.parse('${AppConstants.baseUrl}/auth/login');
    if (kDebugMode) {
      print('Attempting login to: $url with employee_id: $employeeId');
    }
    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'employee_id': employeeId, 'password': password}),
      );

      final responseData = json.decode(response.body);

      if (response.statusCode != 200) {
        throw Exception(responseData['error'] ?? 'Login failed');
      }

      _token = responseData['token'];
      _user = responseData['user'];

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);
      await prefs.setString('user', json.encode(_user));

      // Update FCM Token on login
      updateFcmToken();

      notifyListeners();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logExit(String reason) async {
    final url = Uri.parse('${AppConstants.baseUrl}/users/exit');
    if (_token == null) {
      throw Exception('Not authenticated');
    }
    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: json.encode({'reason': reason}),
      );

      if (response.statusCode != 200) {
        final responseData = json.decode(response.body);
        throw Exception(responseData['error'] ?? 'Failed to log exit');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateFcmToken() async {
    if (_token == null) return;
    try {
      final fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken == null) return;

      if (kDebugMode) {
        print('Updating FCM Token: $fcmToken');
      }

      final url = Uri.parse('${AppConstants.baseUrl}/users/fcm-token');
      await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: json.encode({'fcm_token': fcmToken}),
      );
    } catch (e) {
      print("Failed to update FCM token: $e");
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    notifyListeners();
  }
}
