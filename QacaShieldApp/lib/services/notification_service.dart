import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();

  factory NotificationService() {
    return _instance;
  }

  NotificationService._internal();

  Future<void> initialize() async {
    if (kIsWeb) {
      return;
    }
    // Request permissions
    NotificationSettings settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted notification permission');
    } else {
      print('User declined or has not accepted notification permission');
    }

    // Foreground message handler
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Got a message whilst in the foreground!');
      if (message.notification != null) {
        print('Message also contained a notification: ${message.notification}');
      }
    });
  }

  Future<String?> getToken() async {
    return await FirebaseMessaging.instance.getToken();
  }
}

// Top-level function for background handling
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print("Handling a background message: ${message.messageId}");
}
