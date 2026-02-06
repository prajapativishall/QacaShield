import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/trip_service.dart';
import '../config/constants.dart';
import 'trip_screen.dart';
import 'safety_check_screen.dart';
import 'profile_tab.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  late Future<List<dynamic>> _tripsFuture;

  @override
  void initState() {
    super.initState();
    _refreshTrips();
  }

  Future<void> _refreshTrips() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    setState(() {
      _tripsFuture = TripService(authService.token!).fetchMyTrips();
    });
    await _tripsFuture;
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  String _getGreeting() {
    var hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good Morning';
    }
    if (hour < 17) {
      return 'Good Afternoon';
    }
    return 'Good Evening';
  }

  void _showExitDialog() {
    final TextEditingController reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Log Exit'),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(
            labelText: 'Reason for exit',
            hintText: 'e.g., Shift ended, Emergency',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (reasonController.text.trim().isEmpty) return;
              try {
                final authService = Provider.of<AuthService>(
                  context,
                  listen: false,
                );
                await authService.logExit(reasonController.text.trim());
                if (mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Exit logged successfully')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: $e'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text('Log Exit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _selectedIndex == 0
          ? SafeArea(child: _buildAssignmentsTab())
          : _buildProfileTab(),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment_outlined),
            activeIcon: Icon(Icons.assignment),
            label: 'Assignments',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: AppConstants.primaryColor,
        unselectedItemColor: Colors.grey,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        onTap: _onItemTapped,
      ),
    );
  }

  Widget _buildGreetingHeader() {
    final authService = Provider.of<AuthService>(context, listen: false);
    final user = authService.user;
    final String firstName = user != null && user['name'] != null
        ? user['name'].toString().split(' ')[0]
        : 'User';
    final String dayOfWeek = DateFormat('EEEE').format(DateTime.now());

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
      color: AppConstants.backgroundColor,
      width: double.infinity,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_getGreeting()}, $firstName',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryColor,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'It\'s $dayOfWeek',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          IconButton(
            icon: Icon(Icons.exit_to_app, color: Colors.red),
            onPressed: _showExitDialog,
            tooltip: 'Log Exit',
          ),
        ],
      ),
    );
  }

  Widget _buildAssignmentsTab() {
    return Column(
      children: [
        _buildGreetingHeader(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refreshTrips,
            color: AppConstants.primaryColor,
            child: FutureBuilder<List<dynamic>>(
              future: _tripsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(child: CircularProgressIndicator());
                } else if (snapshot.hasError) {
                  if (snapshot.error.toString().contains('Session expired')) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      Provider.of<AuthService>(context, listen: false).logout();
                    });
                    return Center(
                      child: Text("Session expired. Logging out..."),
                    );
                  }
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 48, color: Colors.red),
                        SizedBox(height: 16),
                        Text(
                          'Error loading assignments: ${snapshot.error}',
                          style: TextStyle(fontSize: 16),
                          textAlign: TextAlign.center,
                        ),
                        TextButton(
                          onPressed: _refreshTrips,
                          child: Text('Retry'),
                        ),
                      ],
                    ),
                  );
                } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return ListView(
                    physics: AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: MediaQuery.of(context).size.height * 0.2,
                      ),
                      Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.assignment_turned_in_outlined,
                              size: 80,
                              color: Colors.grey.shade400,
                            ),
                            SizedBox(height: 16),
                            Text(
                              'No active assignments',
                              style: TextStyle(
                                fontSize: 18,
                                color: Colors.grey.shade600,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Pull down to refresh',
                              style: TextStyle(color: Colors.grey.shade400),
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                }

                final trips = snapshot.data!;
                return ListView.separated(
                  physics: AlwaysScrollableScrollPhysics(),
                  itemCount: trips.length,
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  separatorBuilder: (ctx, i) => SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final trip = trips[index];
                    final isVerified =
                        trip['is_safety_verified'] == true ||
                        trip['is_safety_verified'] == 1;

                    return Card(
                      elevation: 2,
                      shadowColor: Colors.black12,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () {
                          String phase = trip['current_phase'] ?? 'PLANNED';

                          // If Accepted but not verified/started -> Safety Check
                          if (phase == 'ACCEPTED') {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    SafetyCheckScreen(trip: trip),
                              ),
                            ).then((_) => _refreshTrips());
                          } else {
                            // PENDING, ACTIVE, COMPLETED -> Trip Screen
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => TripScreen(trip: trip),
                              ),
                            ).then((_) => _refreshTrips());
                          }
                        },
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: AppConstants.primaryColor
                                              .withOpacity(0.1),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          Icons.local_shipping_outlined,
                                          color: AppConstants.primaryColor,
                                        ),
                                      ),
                                      SizedBox(width: 12),
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Assignment ID: ${trip['task_title'] ?? trip['id']}',
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                              color:
                                                  AppConstants.secondaryColor,
                                            ),
                                          ),
                                          SizedBox(height: 4),
                                          Container(
                                            padding: EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color:
                                                  (trip['current_phase'] ==
                                                          'ACTIVE' ||
                                                      trip['active'] == true)
                                                  ? Colors.green.withOpacity(
                                                      0.1,
                                                    )
                                                  : (trip['current_phase'] ==
                                                        'ACCEPTED')
                                                  ? Colors.orange.withOpacity(
                                                      0.1,
                                                    )
                                                  : (trip['current_phase'] ==
                                                            'PENDING' ||
                                                        trip['current_phase'] ==
                                                            'PLANNED')
                                                  ? Colors.blue.withOpacity(0.1)
                                                  : Colors.grey.withOpacity(
                                                      0.1,
                                                    ),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              (trip['current_phase'] ==
                                                          'ACTIVE' ||
                                                      trip['active'] == true)
                                                  ? 'In Progress'
                                                  : (trip['current_phase'] ==
                                                        'ACCEPTED')
                                                  ? 'Pending Safety Check'
                                                  : (trip['current_phase'] ==
                                                            'PENDING' ||
                                                        trip['current_phase'] ==
                                                            'PLANNED')
                                                  ? 'Pending Acceptance'
                                                  : 'Completed',
                                              style: TextStyle(
                                                color:
                                                    (trip['current_phase'] ==
                                                            'ACTIVE' ||
                                                        trip['active'] == true)
                                                    ? Colors.green.shade700
                                                    : (trip['current_phase'] ==
                                                          'ACCEPTED')
                                                    ? Colors.orange.shade800
                                                    : (trip['current_phase'] ==
                                                              'PENDING' ||
                                                          trip['current_phase'] ==
                                                              'PLANNED')
                                                    ? Colors.blue.shade700
                                                    : Colors.grey.shade700,
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  Icon(
                                    Icons.chevron_right,
                                    color: Colors.grey.shade400,
                                  ),
                                ],
                              ),
                              Divider(
                                height: 24,
                                thickness: 1,
                                color: Colors.grey.shade100,
                              ),
                              Row(
                                children: [
                                  Icon(
                                    Icons.location_on_outlined,
                                    size: 16,
                                    color: Colors.grey,
                                  ),
                                  SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'Destination: ${trip['destination_address'] ?? '${trip['dest_lat']}, ${trip['dest_lng']}'}',
                                      style: TextStyle(
                                        color: Colors.grey.shade700,
                                        fontSize: 13,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileTab() {
    return const ProfileTab();
  }
}
