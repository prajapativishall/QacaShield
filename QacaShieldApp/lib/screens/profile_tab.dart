import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../config/constants.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  _ProfileTabState createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _empIdController;
  late TextEditingController _phoneController;
  late TextEditingController _zoneController;
  late TextEditingController _bloodGroupController;
  late TextEditingController _emergencyController;
  late TextEditingController _latController;
  late TextEditingController _lngController;
  String _selectedRole = 'USER';
  String? _profilePicUrl;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthService>(context, listen: false).user;
    _nameController = TextEditingController(text: user?['name'] ?? '');
    _emailController = TextEditingController(text: user?['email'] ?? '');
    _empIdController = TextEditingController(text: user?['employee_id'] ?? '');
    _phoneController = TextEditingController(text: user?['phone_number'] ?? '');
    _zoneController = TextEditingController(text: user?['circle_zone'] ?? '');
    _bloodGroupController = TextEditingController(
      text: user?['blood_group'] ?? '',
    );
    _emergencyController = TextEditingController(
      text: user?['emergency_contact'] ?? '',
    );
    _latController = TextEditingController(
      text: user?['home_lat']?.toString() ?? '',
    );
    _lngController = TextEditingController(
      text: user?['home_lng']?.toString() ?? '',
    );

    _profilePicUrl = user?['profile_pic_url'];

    // Map backend role to UI value if needed, or just use raw
    String role = user?['role'] ?? 'USER';
    _selectedRole = role;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _empIdController.dispose();
    _phoneController.dispose();
    _zoneController.dispose();
    _bloodGroupController.dispose();
    _emergencyController.dispose();
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Custom App Bar Area (Red Gradient/Solid)
        Container(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 10,
            bottom: 20,
            left: 20,
            right: 20,
          ),
          decoration: BoxDecoration(
            color: Color(0xFFF05A50), // Reddish color from image
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Image.asset(
                      'assets/images/logo.png',
                      width: 24,
                      height: 24,
                    ),
                  ),
                  SizedBox(width: 12),
                  Text(
                    'QacaShield',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              ElevatedButton.icon(
                onPressed: () =>
                    Provider.of<AuthService>(context, listen: false).logout(),
                icon: Icon(Icons.logout, size: 18, color: Color(0xFFF05A50)),
                label: Text(
                  'Logout',
                  style: TextStyle(
                    color: Color(0xFFF05A50),
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: SingleChildScrollView(
            child: Column(
              children: [
                SizedBox(height: 30),
                // Avatar with white border
                Container(
                  padding: EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black12,
                        blurRadius: 10,
                        offset: Offset(0, 5),
                      ),
                    ],
                  ),
                  child: CircleAvatar(
                    radius: 55,
                    backgroundColor: Colors.grey.shade200,
                    backgroundImage:
                        _profilePicUrl != null && _profilePicUrl!.isNotEmpty
                        ? NetworkImage(
                            '${AppConstants.staticBaseUrl}$_profilePicUrl',
                          )
                        : null,
                    child: (_profilePicUrl == null || _profilePicUrl!.isEmpty)
                        ? Icon(
                            Icons.person,
                            size: 60,
                            color: Colors.grey.shade400,
                          )
                        : null,
                  ),
                ),
                SizedBox(height: 16),
                Text(
                  _nameController.text,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A237E), // Dark blue from image
                  ),
                ),
                SizedBox(height: 20),
                // Dots indicator like in image
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    5,
                    (index) => Container(
                      width: 8,
                      height: 8,
                      margin: EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: index == 0 ? Colors.grey : Colors.grey.shade300,
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 30),

                // Profile Cards
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    children: [
                      _buildProfileCard(
                        'Employee ID',
                        _empIdController.text,
                        Icons.shield_outlined,
                        showArrow: true,
                      ),
                      _buildProfileCard(
                        'Mobile Number',
                        _phoneController.text,
                        Icons.phone_outlined,
                      ),
                      _buildProfileCard(
                        'Circle/Zone',
                        _zoneController.text,
                        Icons.location_on_outlined,
                      ),
                      _buildProfileCard(
                        'Emergency',
                        'Contact',
                        Icons.contact_page_outlined,
                        subValue: _emergencyController.text,
                      ),
                      _buildProfileCard(
                        'Blood Group',
                        _bloodGroupController.text,
                        Icons.bloodtype_outlined,
                      ),
                      _buildProfileCard(
                        'Role',
                        _selectedRole == 'USER'
                            ? 'User (Employee)'
                            : _selectedRole,
                        Icons.admin_panel_settings_outlined,
                      ),
                      // Existing details from the list that might not be in the image cards
                      _buildProfileCard(
                        'Email',
                        _emailController.text,
                        Icons.email_outlined,
                      ),
                      _buildProfileCard(
                        'Home Coordinates',
                        '${_latController.text}, ${_lngController.text}',
                        Icons.home_outlined,
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileCard(
    String title,
    String value,
    IconData icon, {
    bool showArrow = false,
    String? subValue,
  }) {
    return Container(
      margin: EdgeInsets.only(bottom: 16),
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.grey.shade600, size: 22),
          ),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                ),
                if (subValue != null && subValue.isNotEmpty) ...[
                  SizedBox(height: 2),
                  Text(
                    subValue,
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                  ),
                ],
              ],
            ),
          ),
          if (showArrow)
            Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 24),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Text(
        text,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: AppConstants.secondaryColor,
          fontSize: 14,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      contentPadding: EdgeInsets.symmetric(horizontal: 0, vertical: 12),
      isDense: true,
      border: UnderlineInputBorder(
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: AppConstants.primaryColor),
      ),
      filled: false,
    );
  }
}
