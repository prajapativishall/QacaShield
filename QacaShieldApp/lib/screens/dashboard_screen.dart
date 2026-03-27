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
  List<dynamic> _completedTrips = [];
  int? _filterYear;
  int? _filterMonth; // 1-12

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
    try {
      await _tripsFuture;
      final completed = await TripService(
        authService.token!,
      ).fetchMyHistory(year: _filterYear, month: _filterMonth);
      setState(() {
        _completedTrips = completed;
      });
    } catch (_) {}
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
                  await _refreshTrips();
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
      body: () {
        if (_selectedIndex == 0) {
          return SafeArea(child: _buildAssignmentsTab());
        }
        if (_selectedIndex == 1) {
          return SafeArea(child: _buildHistoryTab());
        }
        return _buildProfileTab();
      }(),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment_outlined),
            activeIcon: Icon(Icons.assignment),
            label: 'Assignments',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history_toggle_off),
            activeIcon: Icon(Icons.history),
            label: 'History',
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
          TextButton.icon(
            onPressed: _showExitDialog,
            style: TextButton.styleFrom(
              backgroundColor: Colors.red.withOpacity(0.06),
              foregroundColor: Colors.red,
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            icon: Icon(Icons.logout, size: 20),
            label: Text('Exit', style: TextStyle(fontWeight: FontWeight.w600)),
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
                return ListView(
                  physics: AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  children: [
                    ListView.separated(
                      shrinkWrap: true,
                      physics: NeverScrollableScrollPhysics(),
                      itemCount: trips.length,
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
                                final bool hasRunning = trips.any((t) {
                                  if (t == null) return false;
                                  if (t['id'] == trip['id']) return false;
                                  final String p = (t['current_phase'] ?? '')
                                      .toString();
                                  final bool isActive = t['active'] == true;
                                  return isActive ||
                                      p == 'ACTIVE' ||
                                      p == 'REACHED_DESTINATION' ||
                                      p == 'RETURNING_HOME';
                                });
                                if (hasRunning) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Finish the current assignment before starting another.',
                                      ),
                                    ),
                                  );
                                  return;
                                }
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
                                    builder: (context) =>
                                        TripScreen(trip: trip),
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
                                                  color: AppConstants
                                                      .secondaryColor,
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
                                                          trip['active'] ==
                                                              true)
                                                      ? Colors.green
                                                            .withOpacity(0.1)
                                                      : (trip['current_phase'] ==
                                                            'ACCEPTED')
                                                      ? Colors.red.withOpacity(
                                                          0.08,
                                                        )
                                                      : (trip['current_phase'] ==
                                                                'PENDING' ||
                                                            trip['current_phase'] ==
                                                                'PLANNED')
                                                      ? Colors.blue.withOpacity(
                                                          0.1,
                                                        )
                                                      : Colors.grey.withOpacity(
                                                          0.1,
                                                        ),
                                                  borderRadius:
                                                      BorderRadius.circular(8),
                                                ),
                                                child: Text(
                                                  (trip['current_phase'] ==
                                                              'ACTIVE' ||
                                                          trip['active'] ==
                                                              true)
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
                                                            trip['active'] ==
                                                                true)
                                                        ? Colors.green.shade700
                                                        : (trip['current_phase'] ==
                                                              'ACCEPTED')
                                                        ? Colors.red.shade700
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
                                        child: Builder(
                                          builder: (context) {
                                            final destAddress =
                                                (trip['destination_address']
                                                    ?.toString()
                                                    .trim() ??
                                                '');
                                            final coordText =
                                                (trip['dest_lat'] != null &&
                                                    trip['dest_lng'] != null)
                                                ? '${trip['dest_lat']}, ${trip['dest_lng']}'
                                                : 'N/A';
                                            final display =
                                                destAddress.isNotEmpty
                                                ? '$destAddress ($coordText)'
                                                : coordText;
                                            return Text(
                                              'Destination: $display',
                                              style: TextStyle(
                                                color: Colors.grey.shade700,
                                                fontSize: 13,
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                            );
                                          },
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
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHistoryTab() {
    final months = const [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final currentYear = DateTime.now().year;
    final years = List<int>.generate(6, (i) => currentYear - i);
    return Column(
      children: [
        _buildGreetingHeader(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int?>(
                  value: _filterMonth,
                  decoration: InputDecoration(
                    labelText: 'Month',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    isDense: true,
                  ),
                  items: [
                    DropdownMenuItem(value: null, child: Text('All')),
                    ...List.generate(
                      12,
                      (i) => DropdownMenuItem(
                        value: i + 1,
                        child: Text(months[i]),
                      ),
                    ),
                  ],
                  onChanged: (val) {
                    setState(() {
                      _filterMonth = val;
                      if (val != null && _filterYear == null) {
                        _filterYear = DateTime.now().year;
                      }
                    });
                    _refreshTrips();
                  },
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<int?>(
                  value: _filterYear,
                  decoration: InputDecoration(
                    labelText: 'Year',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    isDense: true,
                  ),
                  items: [
                    DropdownMenuItem(value: null, child: Text('All')),
                    ...years.map(
                      (y) =>
                          DropdownMenuItem(value: y, child: Text(y.toString())),
                    ),
                  ],
                  onChanged: (val) {
                    setState(() => _filterYear = val);
                    _refreshTrips();
                  },
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refreshTrips,
            color: AppConstants.primaryColor,
            child: _completedTrips.isEmpty
                ? ListView(
                    physics: AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: MediaQuery.of(context).size.height * 0.25,
                      ),
                      Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.history_toggle_off,
                              size: 80,
                              color: Colors.grey.shade400,
                            ),
                            SizedBox(height: 16),
                            Text(
                              'No assignment history yet',
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
                  )
                : ListView.builder(
                    physics: AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    itemCount: _completedTrips.length,
                    itemBuilder: (context, index) {
                      final trip = _completedTrips[index];

                      String destinationText = 'N/A';
                      final destAddress = trip['destination_address'];
                      if (destAddress != null &&
                          destAddress.toString().trim().isNotEmpty) {
                        destinationText = destAddress.toString();
                      } else if (trip['dest_lat'] != null &&
                          trip['dest_lng'] != null) {
                        destinationText =
                            '${trip['dest_lat']}, ${trip['dest_lng']}';
                      }

                      return Card(
                        elevation: 1,
                        shadowColor: Colors.black12,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: ListTile(
                          leading: Builder(
                            builder: (_) {
                              final String phase = (trip['current_phase'] ?? '')
                                  .toString();
                              final bool isEarlyExit =
                                  trip['exit_reason'] != null &&
                                  (trip['exit_reason'] as String)
                                      .toString()
                                      .trim()
                                      .isNotEmpty;
                              final Color statusColor = phase == 'CANCELLED'
                                  ? Colors.red
                                  : (isEarlyExit
                                        ? Colors.orange
                                        : Colors.green);
                              final IconData statusIcon = phase == 'CANCELLED'
                                  ? Icons.cancel
                                  : (isEarlyExit
                                        ? Icons.logout
                                        : Icons.check_circle);
                              return Icon(statusIcon, color: statusColor);
                            },
                          ),
                          title: Text(
                            'Assignment ID: ${trip['task_title'] ?? trip['id']}',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: AppConstants.secondaryColor,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(height: 4),
                              Builder(
                                builder: (_) {
                                  final String phase =
                                      (trip['current_phase'] ?? '').toString();
                                  final bool isEarlyExit =
                                      trip['exit_reason'] != null &&
                                      (trip['exit_reason'] as String)
                                          .toString()
                                          .trim()
                                          .isNotEmpty;
                                  final String statusLabel =
                                      phase == 'CANCELLED'
                                      ? 'Cancelled'
                                      : (isEarlyExit
                                            ? 'Early Exit'
                                            : 'Completed');
                                  final Color statusColor = phase == 'CANCELLED'
                                      ? Colors.red
                                      : (isEarlyExit
                                            ? Colors.orange
                                            : Colors.green);
                                  final DateTime? endTime =
                                      trip['actual_end_time'] != null
                                      ? DateTime.tryParse(
                                          trip['actual_end_time'],
                                        )?.toLocal()
                                      : null;
                                  final String whenText = endTime != null
                                      ? DateFormat(
                                          'dd MMM, hh:mm a',
                                        ).format(endTime)
                                      : 'N/A';
                                  return Row(
                                    children: [
                                      Container(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: statusColor.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(
                                            6,
                                          ),
                                        ),
                                        child: Text(
                                          statusLabel,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: statusColor,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                      SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          '$statusLabel at: $whenText',
                                          style: TextStyle(fontSize: 12),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              ),
                              if (trip['exit_reason'] != null &&
                                  (trip['exit_reason'] as String)
                                      .toString()
                                      .trim()
                                      .isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2.0),
                                  child: Text(
                                    'Reason: ${trip['exit_reason']}',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade700,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              SizedBox(height: 2),
                              Text(
                                'Destination: $destinationText',
                                style: TextStyle(fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (trip['arrival_lat'] != null &&
                                  trip['arrival_lng'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2.0),
                                  child: Text(
                                    'Arrival: ${trip['arrival_lat']}, ${trip['arrival_lng']}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.blue.shade700,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              if (trip['completed_lat'] != null &&
                                  trip['completed_lng'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 1.0),
                                  child: Text(
                                    'Completed: ${trip['completed_lat']}, ${trip['completed_lng']}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.green.shade700,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                            ],
                          ),
                        ),
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
