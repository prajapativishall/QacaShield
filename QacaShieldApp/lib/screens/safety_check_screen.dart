import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/trip_service.dart';
import '../config/constants.dart';
import 'trip_screen.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:location/location.dart' as loc;

class SafetyCheckScreen extends StatefulWidget {
  final Map<String, dynamic> trip;
  final bool isReturnTrip;

  SafetyCheckScreen({required this.trip, this.isReturnTrip = false});

  @override
  _SafetyCheckScreenState createState() => _SafetyCheckScreenState();
}

class _SafetyCheckScreenState extends State<SafetyCheckScreen> {
  File? _helmetImage;
  XFile? _webImage; // Store XFile for web since File is not supported
  bool _brakes = false;
  bool _fuel = false;
  bool _lights = false;
  bool _fitToDrive = false;
  bool _isUploading = false;

  // Real-time verification state
  bool _isVerifying = false;
  bool _isHelmetVerified = false;
  String? _verificationMessage;

  final ImagePicker _picker = ImagePicker();

  Future<void> _verifyHelmet() async {
    setState(() {
      _isVerifying = true;
      _verificationMessage = "Analyzing helmet...";
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final tripService = TripService(authService.token!);

      Uint8List? bytes;
      if (kIsWeb && _webImage != null) {
        bytes = await _webImage!.readAsBytes();
      }

      final checklist = {
        'brakes': _brakes,
        'fuel': _fuel,
        'lights': _lights,
        'fitToDrive': _fitToDrive,
      };

      final response = await tripService.uploadSafetyCheck(
        widget.trip['id'],
        kIsWeb ? _webImage!.path : _helmetImage!.path,
        checklist,
        fileBytes: bytes,
      );

      if (mounted) {
        setState(() {
          _isVerifying = false;
          _isHelmetVerified = true;
          _verificationMessage = response['message'] ?? "Helmet Verified";
        });
      }
    } catch (e) {
      print("Verification error: $e");
      String errorMsg = e.toString();
      if (errorMsg.contains("Exception: ")) {
        errorMsg = errorMsg.replaceAll("Exception: ", "");
      }

      if (mounted) {
        setState(() {
          _isVerifying = false;
          _isHelmetVerified = false;
          _verificationMessage = errorMsg;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMsg), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _takeSelfie() async {
    // Request permission explicitly first
    var status = await Permission.camera.status;
    if (status.isDenied) {
      status = await Permission.camera.request();
    }

    if (status.isPermanentlyDenied) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "Camera permission is required. Please enable it in settings.",
            ),
          ),
        );
        openAppSettings();
      }
      return;
    }

    if (!status.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Camera permission denied.")));
      }
      return;
    }

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("No cameras found on this device.")),
          );
        }
        return;
      }

      final frontCamera = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final result = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CameraCaptureScreen(camera: frontCamera),
        ),
      );

      if (result != null && result is XFile) {
        setState(() {
          if (kIsWeb) {
            _webImage = result;
            _helmetImage = null; // File not used on web
          } else {
            _helmetImage = File(result.path);
            _webImage = null;
          }
          // Reset and start verification
          _isHelmetVerified = false;
          _verificationMessage = null;
        });

        // Trigger real-time verification
        _verifyHelmet();
      }
    } catch (e) {
      print("Error opening camera: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "Failed to open camera: $e. Try checking permissions manually.",
            ),
          ),
        );
      }
    }
  }

  Future<void> _submitSafetyCheck() async {
    if (_helmetImage == null && _webImage == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Please take a helmet selfie.")));
      return;
    }

    if (!_isHelmetVerified) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_verificationMessage ?? "Please verify helmet first."),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!_fitToDrive) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("You must confirm you are fit to drive.")),
      );
      return;
    }

    setState(() {
      _isUploading = true;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final tripService = TripService(authService.token!);

      // Note: Image was already uploaded and verified in _verifyHelmet.
      // We proceed directly to start the trip.
      // If backend requires checklist data to be sent again, we would need a separate endpoint
      // or we just re-upload. For now, assuming verification saved the image.

      // 2. Start Trip or Return Trip
      loc.LocationData? locData;
      try {
        final location = loc.Location();
        bool _serviceEnabled = await location.serviceEnabled();
        if (!_serviceEnabled) {
          _serviceEnabled = await location.requestService();
        }

        loc.PermissionStatus _permissionGranted = await location
            .hasPermission();
        if (_permissionGranted == loc.PermissionStatus.denied) {
          _permissionGranted = await location.requestPermission();
        }

        if (_serviceEnabled &&
            _permissionGranted == loc.PermissionStatus.granted) {
          locData = await location.getLocation();
        }
      } catch (e) {
        print("Error getting location: $e");
      }

      if (widget.isReturnTrip) {
        if (locData == null) {
          throw Exception("Location required for return trip");
        }
        await tripService.startReturnTrip(
          widget.trip['id'],
          locData.latitude!,
          locData.longitude!,
        );
      } else {
        await tripService.startTrip(
          widget.trip['id'],
          lat: locData?.latitude,
          lng: locData?.longitude,
        );
      }

      if (!mounted) return;

      if (widget.isReturnTrip) {
        // Return Trip: Return to TripScreen and trigger refresh
        Navigator.pop(context, true);
      } else {
        // Start Trip: Navigate to TripScreen (Active)
        final updatedTrip = Map<String, dynamic>.from(widget.trip);
        updatedTrip['active'] = true;
        updatedTrip['current_phase'] = 'ACTIVE';
        if (locData != null) {
          updatedTrip['origin_lat'] = locData.latitude;
          updatedTrip['origin_lng'] = locData.longitude;
        }

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => TripScreen(trip: updatedTrip)),
        );
      }
    } catch (e) {
      final authService2 = Provider.of<AuthService>(context, listen: false);
      final ts = TripService(authService2.token!);
      final now = DateTime.now().toIso8601String();
      if (widget.isReturnTrip) {
        if (locData != null) {
          await ts.enqueueEvent({
            'type': 'start_return',
            'tripId': widget.trip['id'],
            'lat': locData.latitude,
            'lng': locData.longitude,
            'ts': now
          });
        } else {
          await ts.enqueueEvent({
            'type': 'start_return',
            'tripId': widget.trip['id'],
            'ts': now
          });
        }
        if (mounted) Navigator.pop(context, true);
      } else {
        await ts.enqueueEvent({
          'type': 'start_trip',
          'tripId': widget.trip['id'],
          'lat': locData?.latitude,
          'lng': locData?.longitude,
          'ts': now
        });
        if (mounted) {
          final updatedTrip = Map<String, dynamic>.from(widget.trip);
          updatedTrip['active'] = true;
          updatedTrip['current_phase'] = 'ACTIVE';
          if (locData != null) {
            updatedTrip['origin_lat'] = locData.latitude;
            updatedTrip['origin_lng'] = locData.longitude;
          }
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => TripScreen(trip: updatedTrip)),
          );
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  Widget _buildChecklistItem(
    String title,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Container(
      margin: EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: value ? AppConstants.primaryColor : Colors.grey.shade200,
          width: value ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 5,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: SwitchListTile(
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: value ? AppConstants.secondaryColor : Colors.grey.shade700,
          ),
        ),
        value: value,
        onChanged: onChanged,
        activeColor: AppConstants.primaryColor,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final imageProvider = _helmetImage != null
        ? FileImage(_helmetImage!)
        : (_webImage != null ? NetworkImage(_webImage!.path) : null);
    // Note: NetworkImage(_webImage!.path) works on Web for XFile blobs

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Safety Check",
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppConstants.primaryColor,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Info Card
                Container(
                  padding: EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade100),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue.shade700),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          "Please complete all safety checks and upload a photo to start your assignment.",
                          style: TextStyle(
                            color: Colors.blue.shade800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 24),

                Text(
                  "Helmet Selfie",
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppConstants.secondaryColor,
                  ),
                ),
                SizedBox(height: 12),

                GestureDetector(
                  onTap: _takeSelfie,
                  child: Container(
                    height: 250,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: (_helmetImage != null || _webImage != null)
                            ? AppConstants.primaryColor
                            : Colors.grey.shade300,
                        width: (_helmetImage != null || _webImage != null)
                            ? 2
                            : 1,
                      ),
                      image: (_helmetImage != null || _webImage != null)
                          ? DecorationImage(
                              image: kIsWeb
                                  ? NetworkImage(_webImage!.path)
                                  : FileImage(_helmetImage!) as ImageProvider,
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: (_helmetImage == null && _webImage == null)
                        ? Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black12,
                                      blurRadius: 10,
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  Icons.camera_front,
                                  size: 40,
                                  color: AppConstants.primaryColor,
                                ),
                              ),
                              SizedBox(height: 16),
                              Text(
                                "Tap to take Helmet Selfie (Front Camera)",
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          )
                        : Stack(
                            children: [
                              if (_isVerifying)
                                Center(
                                  child: Container(
                                    padding: EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        CircularProgressIndicator(
                                          color: Colors.white,
                                        ),
                                        SizedBox(height: 8),
                                        Text(
                                          "Verifying...",
                                          style: TextStyle(color: Colors.white),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              if (!_isVerifying && _isHelmetVerified)
                                Center(
                                  child: Container(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.green.withOpacity(0.9),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.check_circle,
                                          color: Colors.white,
                                        ),
                                        SizedBox(width: 8),
                                        Text(
                                          "Verified",
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              if (!_isVerifying &&
                                  !_isHelmetVerified &&
                                  _verificationMessage != null)
                                Center(
                                  child: Container(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.red.withOpacity(0.9),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.error_outline,
                                          color: Colors.white,
                                          size: 32,
                                        ),
                                        SizedBox(height: 4),
                                        Text(
                                          "Not Detected",
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        Text(
                                          "Retake Photo",
                                          style: TextStyle(
                                            color: Colors.white70,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              Positioned(
                                bottom: 12,
                                right: 12,
                                child: Container(
                                  padding: EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black26,
                                        blurRadius: 4,
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    Icons.edit,
                                    color: AppConstants.primaryColor,
                                    size: 20,
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
                ),

                SizedBox(height: 32),
                Text(
                  "Vehicle Checks",
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppConstants.secondaryColor,
                  ),
                ),
                SizedBox(height: 12),

                _buildChecklistItem(
                  "Brakes working properly",
                  _brakes,
                  (val) => setState(() => _brakes = val),
                ),
                _buildChecklistItem(
                  "Fuel level sufficient",
                  _fuel,
                  (val) => setState(() => _fuel = val),
                ),
                _buildChecklistItem(
                  "Lights functioning",
                  _lights,
                  (val) => setState(() => _lights = val),
                ),
                _buildChecklistItem(
                  "I am fit to drive",
                  _fitToDrive,
                  (val) => setState(() => _fitToDrive = val),
                ),

                SizedBox(height: 32),

                ElevatedButton(
                  onPressed: _isUploading ? null : _submitSafetyCheck,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: AppConstants.primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 4,
                  ),
                  child: Text(
                    "Submit & Start Assignment",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                SizedBox(height: 20),
              ],
            ),
          ),

          if (_isUploading)
            Container(
              color: Colors.black54,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 20),
                    Text(
                      "Verifying & Starting Assignment...",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class CameraCaptureScreen extends StatefulWidget {
  final CameraDescription camera;

  const CameraCaptureScreen({Key? key, required this.camera}) : super(key: key);

  @override
  _CameraCaptureScreenState createState() => _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends State<CameraCaptureScreen> {
  late CameraController _controller;
  late Future<void> _initializeControllerFuture;

  @override
  void initState() {
    super.initState();
    _controller = CameraController(widget.camera, ResolutionPreset.medium);
    _initializeControllerFuture = _controller.initialize();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: FutureBuilder<void>(
        future: _initializeControllerFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.done) {
            return Stack(
              children: [
                Center(child: CameraPreview(_controller)),
                Positioned(
                  bottom: 30,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: FloatingActionButton(
                      onPressed: () async {
                        try {
                          await _initializeControllerFuture;
                          final image = await _controller.takePicture();
                          Navigator.pop(context, image);
                        } catch (e) {
                          print(e);
                        }
                      },
                      backgroundColor: Colors.white,
                      child: Icon(
                        Icons.camera_alt,
                        color: Colors.black,
                        size: 30,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 40,
                  left: 20,
                  child: IconButton(
                    icon: Icon(Icons.close, color: Colors.white, size: 30),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            );
          } else {
            return Center(child: CircularProgressIndicator());
          }
        },
      ),
    );
  }
}
