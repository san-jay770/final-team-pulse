import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Top-level background messaging handler for FCM.
/// Must be outside any class and annotated with @pragma('vm:entry-point').
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (e) {
    if (kDebugMode) {
      print('Firebase initialize in background handler warning: $e');
    }
  }
  if (kDebugMode) {
    print('Handling background message: ${message.messageId}');
    print('Title: ${message.notification?.title}, Body: ${message.notification?.body}');
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static const String _channelId = 'team_pulse_notifications';
  static const String _channelName = 'Team Pulse Notifications';
  static const String _channelDesc = 'Notifications for task updates, team announcements, and alerts.';

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  final StreamController<String?> _tokenStreamController = StreamController<String?>.broadcast();
  Stream<String?> get onTokenRefresh => _tokenStreamController.stream;

  /// Initialize Firebase & Local Notifications
  Future<void> initialize() async {
    // Register background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Initialize local notifications for foreground popups
    await _setupLocalNotifications();

    // Request permissions (especially for iOS and Android 13+)
    await requestPermissions();

    // Setup FCM Foreground & Background click listeners
    _setupFcmListeners();

    // Fetch initial FCM token
    await _fetchToken();
  }

  /// Request User Permission for Notifications
  Future<bool> requestPermissions() async {
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
      criticalAlert: false,
      announcement: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      if (kDebugMode) print('User granted notification permissions');
      return true;
    } else if (settings.authorizationStatus == AuthorizationStatus.provisional) {
      if (kDebugMode) print('User granted provisional notification permissions');
      return true;
    } else {
      if (kDebugMode) print('User declined or has not accepted notification permissions');
      return false;
    }
  }

  /// Setup Flutter Local Notifications plugin
  Future<void> _setupLocalNotifications() async {
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        if (kDebugMode) {
          print('Local notification tapped with payload: ${response.payload}');
        }
      },
    );

    // Create High Importance Notification Channel for Android
    if (Platform.isAndroid) {
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDesc,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  /// Setup FCM listeners for Foreground and Click events
  void _setupFcmListeners() {
    // 1. Foreground Notifications (App is active / open)
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('Foreground Message received: ${message.notification?.title}');
      }
      showLocalNotification(message);
    });

    // 2. Notification Clicked while App in Background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('Notification clicked while app in background: ${message.data}');
      }
    });

    // 3. Notification Clicked when App was completely Killed
    _fcm.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        if (kDebugMode) {
          print('Notification clicked when app launched from terminated state: ${message.data}');
        }
      }
    });

    // 4. Token Refresh Listener
    _fcm.onTokenRefresh.listen((String newToken) {
      _fcmToken = newToken;
      _tokenStreamController.add(newToken);
      if (kDebugMode) print('FCM Token Refreshed: $newToken');
    });
  }

  /// Show Foreground Heads-Up Notification Banner
  Future<void> showLocalNotification(RemoteMessage message) async {
    RemoteNotification? notification = message.notification;
    AndroidNotification? android = message.notification?.android;

    String title = notification?.title ?? message.data['title'] ?? 'Team Pulse';
    String body = notification?.body ?? message.data['body'] ?? 'New notification received';

    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDesc,
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      icon: '@mipmap/ic_launcher',
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails platformDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      platformDetails,
      payload: message.data.toString(),
    );
  }

  /// Fetch FCM Token
  Future<String?> _fetchToken() async {
    try {
      _fcmToken = await _fcm.getToken();
      if (kDebugMode) {
        print('========================================');
        print('FCM DEVICE TOKEN: $_fcmToken');
        print('========================================');
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching FCM Token: $e');
    }
    return _fcmToken;
  }
}
