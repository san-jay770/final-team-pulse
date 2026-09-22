import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/notification_service.dart';
import '../utils/app_theme.dart';
import 'offline_screen.dart';

class WebViewScreen extends StatefulWidget {
  final String initialUrl;

  const WebViewScreen({
    Key? key,
    this.initialUrl = 'http://127.0.0.1:5000',
  }) : super(key: key);

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  InAppWebViewController? webViewController;
  PullToRefreshController? pullToRefreshController;
  
  double progress = 0;
  bool isLoading = true;
  bool isOffline = false;
  String currentTitle = 'Team Pulse';
  String currentUrl = '';

  final InAppWebViewSettings options = InAppWebViewSettings(
    useShouldOverrideUrlLoading: true,
    mediaPlaybackRequiresUserGesture: false,
    useHybridComposition: true,
    allowsInlineMediaPlayback: true,
    transparentBackground: true,
    supportZoom: false,
    javaScriptEnabled: true,
    domStorageEnabled: true,
    databaseEnabled: true,
    cacheEnabled: true,
    clearCache: false,
  );

  @override
  void initState() {
    super.initState();
    currentUrl = _getAdaptiveUrl(widget.initialUrl);
    _initPullToRefresh();
    _checkConnectivity();
  }

  String _getAdaptiveUrl(String targetUrl) {
    // Android emulator host address mapping if local server is tested on emulator
    if (Platform.isAndroid && targetUrl.contains('127.0.0.1')) {
      return targetUrl.replaceAll('127.0.0.1', '10.0.2.2');
    }
    return targetUrl;
  }

  void _initPullToRefresh() {
    pullToRefreshController = PullToRefreshController(
      settings: PullToRefreshSettings(
        color: AppTheme.primary,
      ),
      onRefresh: () async {
        if (Platform.isAndroid) {
          webViewController?.reload();
        } else if (Platform.isIOS) {
          webViewController?.loadUrl(
            urlRequest: URLRequest(url: await webViewController?.getUrl()),
          );
        }
      },
    );
  }

  Future<void> _checkConnectivity() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    if (connectivityResult == ConnectivityResult.none) {
      setState(() => isOffline = true);
    }
  }

  Future<bool> _onWillPop() async {
    if (webViewController != null && await webViewController!.canGoBack()) {
      webViewController!.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    if (isOffline) {
      return OfflineScreen(
        onRetry: () async {
          setState(() {
            isOffline = false;
            isLoading = true;
          });
          webViewController?.reload();
        },
      );
    }

    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (didPop) return;
        final canBack = await webViewController?.canGoBack() ?? false;
        if (canBack) {
          webViewController?.goBack();
        } else {
          if (context.mounted) {
            Navigator.of(context).maybePop();
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(
          title: Text(
            currentTitle,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () => webViewController?.reload(),
              tooltip: 'Refresh Page',
            ),
            IconButton(
              icon: const Icon(Icons.home_outlined),
              onPressed: () => webViewController?.loadUrl(
                urlRequest: URLRequest(url: WebUri(currentUrl)),
              ),
              tooltip: 'Home Dashboard',
            ),
          ],
          bottom: progress < 1.0 && isLoading
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(3.0),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.white24,
                    color: AppTheme.secondary,
                  ),
                )
              : null,
        ),
        body: Stack(
          children: [
            InAppWebView(
              initialUrlRequest: URLRequest(url: WebUri(currentUrl)),
              initialSettings: options,
              pullToRefreshController: pullToRefreshController,
              onWebViewCreated: (controller) {
                webViewController = controller;
                controller.addJavaScriptHandler(
                  handlerName: 'getFcmToken',
                  callback: (args) {
                    return NotificationService().fcmToken;
                  },
                );
              },
              onLoadStart: (controller, url) {
                setState(() {
                  isLoading = true;
                });
              },
              onTitleChanged: (controller, title) {
                if (title != null && title.isNotEmpty) {
                  setState(() {
                    currentTitle = title;
                  });
                }
              },
              onLoadStop: (controller, url) async {
                pullToRefreshController?.endRefreshing();
                setState(() {
                  isLoading = false;
                });
                
                // Inject FCM token into web frontend session if available
                final token = NotificationService().fcmToken;
                if (token != null && token.isNotEmpty) {
                  controller.evaluateJavascript(source: """
                    if (typeof window.registerFcmToken === 'function') {
                      window.registerFcmToken('$token');
                    }
                  """);
                }
              },
              onProgressChanged: (controller, p) {
                if (p == 100) {
                  pullToRefreshController?.endRefreshing();
                }
                setState(() {
                  progress = p / 100;
                  if (p == 100) isLoading = false;
                });
              },
              onReceivedError: (controller, request, error) {
                pullToRefreshController?.endRefreshing();
                if (request.isForMainFrame ?? true) {
                  setState(() {
                    isOffline = true;
                    isLoading = false;
                  });
                }
              },
            ),
            if (isLoading && progress < 0.3)
              Container(
                color: AppTheme.background,
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SpinKitFadingCube(
                        color: AppTheme.primary,
                        size: 45.0,
                      ),
                      SizedBox(height: 20),
                      Text(
                        'Loading Team Pulse...',
                        style: TextStyle(
                          fontSize: 15,
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
