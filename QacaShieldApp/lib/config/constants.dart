import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppConstants {
  static const String appName = 'QacaShield';

  // Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator/Web
  // Or your machine's LAN IP for physical device
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://127.0.0.1:4000/api';
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      // return 'http://10.0.2.2:4000/api'; // Use this for Emulator
      return 'http://14.56.225.22:4000/api'; // Use this for Physical Device (Your LAN IP)
    } else {
      return 'http://127.0.0.1:4000/api'; // iOS Simulator or fallback
    }
  }

  // Base URL for static assets (images) - without /api suffix
  static String get staticBaseUrl {
    if (kIsWeb) {
      return 'http://127.0.0.1:4000';
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      // return 'http://10.0.2.2:4000'; // Use this for Emulator
      return 'http://192.168.1.12:4000'; // Use this for Physical Device (Your LAN IP)
    } else {
      return 'http://127.0.0.1:4000'; // iOS Simulator or fallback
    }
  }

  // Colors
  static const Color primaryColor = Color(0xFFFF6A00); // Safety Orange
  static const Color primaryDark = Color(0xFFE65100);
  static const Color secondaryColor = Color(0xFF0B1F3A); // Navy Blue
  static const Color backgroundColor = Color(0xFFF3F4F6);
  static const Color surfaceColor = Colors.white;
  static const Color errorColor = Colors.red;
}
