import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'utils/app_theme.dart';
import 'screens/web_view_screen.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Set system UI status bar colors
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: AppTheme.darkSidebar,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppTheme.darkSidebar,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Firebase and Notification Service
  try {
    await Firebase.initializeApp();
    await NotificationService().initialize();
    if (kDebugMode) {
      print('Firebase & FCM Notification Service Initialized Successfully.');
    }
  } catch (e) {
    if (kDebugMode) {
      print('Firebase initialization notice: $e');
      print('Make sure google-services.json is present in android/app/');
    }
  }

  runApp(const TeamPulseApp());
}

class TeamPulseApp extends StatelessWidget {
  const TeamPulseApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Team Pulse',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const WebViewScreen(
        initialUrl: 'http://127.0.0.1:5000',
      ),
    );
  }
}
