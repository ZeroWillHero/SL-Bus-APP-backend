# SL Bus App - Android Application Requirements
## Bus Owner + Conductor Native Android App (Kotlin)

**Document Version:** 1.0  
**Last Updated:** May 19, 2026  
**Target:** Native Android App (Kotlin)  
**Backend API:** NestJS 11 + PostgreSQL  
**API Base URL:** `https://api.slbus.local/api/v1/` (or environment-specific)  

---

## 1. Executive Summary

This document specifies the requirements for developing a native Android application using **Kotlin** that enables **Bus Owners** and **Conductors** to manage their transportation operations on the SL Bus platform.

### 1.1 Key User Personas

| Role | Primary Functions |
|------|-------------------|
| **Bus Owner** | Register buses, manage fleet, assign conductors, view schedules & bookings, manage documents |
| **Conductor** | View assigned buses, manage passenger records, check schedules, report issues |

---

## 2. Architecture & Tech Stack

### 2.1 Android Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer (Jetpack Compose/XML)   │
│        (Activities, Fragments, ViewModels)          │
├─────────────────────────────────────────────────────┤
│              Data Layer (Repository Pattern)        │
│      (Network, Local Database, Preferences)         │
├─────────────────────────────────────────────────────┤
│                 API Service Layer (Retrofit)        │
│         (HTTP Client, Interceptors, Auth)           │
├─────────────────────────────────────────────────────┤
│              Models & Data Classes (Kotlin)         │
│              (DTOs, Entities, ViewStates)           │
└─────────────────────────────────────────────────────┘
```

### 2.2 Required Dependencies

#### Core Jetpack Libraries
- `androidx.appcompat:appcompat` (14.0+)
- `androidx.lifecycle:lifecycle-viewmodel-ktx` (2.8+)
- `androidx.lifecycle:lifecycle-livedata-ktx` (2.8+)
- `androidx.navigation:navigation-fragment-ktx` (2.8+)
- `androidx.navigation:navigation-ui-ktx` (2.8+)

#### Networking
- `com.squareup.retrofit2:retrofit` (2.11+)
- `com.squareup.retrofit2:converter-gson` (2.11+)
- `com.squareup.okhttp3:okhttp` (4.12+)
- `com.squareup.okhttp3:logging-interceptor` (4.12+)

#### Local Storage
- `androidx.room:room-runtime` (2.6+)
- `androidx.room:room-ktx` (2.6+)
- `androidx.datastore:datastore-preferences` (1.1+)

#### Async & Concurrency
- `org.jetbrains.kotlinx:kotlinx-coroutines-android` (1.8+)
- `org.jetbrains.kotlinx:kotlinx-coroutines-core` (1.8+)

#### Dependency Injection
- `com.google.dagger:dagger` (2.51+)
- `com.google.dagger:dagger-android` (2.51+)
- `com.google.dagger:dagger-android-processor` (2.51+)

#### UI Libraries
- `com.google.android.material:material` (1.11+)
- `androidx.constraintlayout:constraintlayout` (2.1+)

#### JSON Parsing
- `com.google.code.gson:gson` (2.10+)

#### Image Loading
- `com.github.bumptech.glide:glide` (4.16+)

#### Testing
- `junit:junit` (4.13+)
- `androidx.test.espresso:espresso-core` (3.6+)
- `androidx.test:runner` (1.6+)

---

## 3. Authentication & Authorization

### 3.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User launches app → Check local token validity              │
├─────────────────────────────────────────────────────────────┤
│ If token exists & valid → Auto-login (Skip to Dashboard)    │
│ If token expired → Attempt refresh token request            │
│ If no token → Show Login Screen                             │
├─────────────────────────────────────────────────────────────┤
│ LOGIN SCREEN                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Email/Phone: [_________________]                        │ │
│ │ Password:    [_________________]                        │ │
│ │ [LOGIN] [REGISTER]                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Success: Store token → Fetch user profile → Route to role   │
│ Failure: Show error toast & allow retry                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 API Endpoints - Authentication

#### POST `/auth/register`
**Purpose:** Register a new user account

**Request:**
```kotlin
{
  "username": "john@example.com",  // or phone number
  "password": "SecurePass@123"
}
```

**Response (201 Created):**
```kotlin
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "BusOwner" | "Conductor"
  }
}
```

#### POST `/auth/login`
**Purpose:** Authenticate user and obtain tokens

**Request:**
```kotlin
{
  "username": "john@example.com",  // email or phone
  "password": "SecurePass@123"
}
```

**Response (200 OK):**
```kotlin
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",  // sent as httpOnly cookie
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "BusOwner" | "Conductor",
    "email": "john@example.com",
    "phone": "+94771234567"
  }
}
```

#### POST `/auth/refresh`
**Purpose:** Refresh expired access token

**Request:** Cookie-based (refresh_token in httpOnly cookie)

**Response (200 OK):**
```kotlin
{
  "success": true,
  "message": "New access token issued",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### GET `/auth/verify`
**Purpose:** Verify current token and get authenticated user info

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200 OK):**
```kotlin
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "phone": "+94771234567",
    "roles": ["BusOwner"]
  }
}
```

#### POST `/auth/logout`
**Purpose:** Logout and clear refresh token cookie

**Response (200 OK):**
```kotlin
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 3.3 Token Management in Android

**Implementation Details:**

```kotlin
// Store tokens in Android's SharedPreferences or DataStore
// Access Token: In-memory cache (short-lived)
// Refresh Token: Secure storage (httpOnly cookie alternative)

class TokenManager(context: Context) {
    private val dataStore = PreferencesDataStore(context)
    
    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        // Save both tokens securely
    }
    
    suspend fun getAccessToken(): String? {
        // Retrieve from memory or DataStore
    }
    
    suspend fun refreshAccessToken(): Boolean {
        // Call /auth/refresh endpoint
        // Update stored tokens
    }
    
    suspend fun clearTokens() {
        // Clear on logout
    }
}
```

---

## 4. User Roles & Permissions

### 4.1 Role-Based Access Control (RBAC)

#### Bus Owner Role
- **Can:**
  - Register new buses
  - Update bus information
  - Upload bus documents (RC, insurance, etc.)
  - View assigned conductors
  - Assign/unassign conductors to buses
  - View bus schedules
  - View bookings for their buses
  - Manage routes and schedules

- **Cannot:**
  - Access conductor accounts
  - Modify conductor license status
  - Process payments
  - Access customer bookings directly (read-only)

#### Conductor Role
- **Can:**
  - View assigned buses
  - Check trip schedules
  - View passenger manifest
  - Report trip issues
  - Update personal profile

- **Cannot:**
  - Register buses
  - Manage other conductors
  - Access financial data
  - Modify schedules

### 4.2 Permission Enforcement

Every API request includes the Authorization header with JWT token:

```kotlin
Authorization: Bearer {accessToken}
```

Backend validates:
1. Token signature and expiration
2. User's role matches endpoint requirement
3. Resource ownership (bus owner can only view own buses)

---

## 5. Core Features & User Flows

### 5.1 Bus Owner Workflows

#### 5.1.1 Register a Bus
```
┌──────────────────────────────────────────────────────┐
│ 1. Navigate to "Register Bus" screen                 │
├──────────────────────────────────────────────────────┤
│ 2. Enter bus details:                                │
│    - Registration Number (e.g., NB-1234)            │
│    - Model (e.g., Ashok Leyland)                    │
│    - Year (2019)                                     │
│    - Total Seats (40)                                │
│    - Seat Layout (rows × cols)                       │
├──────────────────────────────────────────────────────┤
│ 3. Upload documents:                                 │
│    - Registration Certificate (PDF/Image)           │
│    - Insurance Certificate (PDF/Image)              │
│    - Roadworthiness Certificate (PDF/Image)         │
├──────────────────────────────────────────────────────┤
│ 4. Submit for approval                              │
│    Status: PENDING → APPROVED/REJECTED               │
├──────────────────────────────────────────────────────┤
│ 5. On approval: Can assign conductors & create      │
│    schedules                                         │
└──────────────────────────────────────────────────────┘
```

#### 5.1.2 Manage Conductors
```
┌──────────────────────────────────────────────────────┐
│ 1. View list of available conductors (search/filter) │
├──────────────────────────────────────────────────────┤
│ 2. Select a bus from your fleet                      │
├──────────────────────────────────────────────────────┤
│ 3. Assign conductor to bus                          │
│    - Validation: Conductor license must be verified  │
│    - Check: No existing assignment on same date      │
├──────────────────────────────────────────────────────┤
│ 4. View assigned conductors for a bus               │
│    - Show conductor details                         │
│    - Show assignment start date                     │
│    - Option to unassign                             │
└──────────────────────────────────────────────────────┘
```

#### 5.1.3 Manage Schedules
```
┌──────────────────────────────────────────────────────┐
│ 1. Create schedule (POST /schedules)                │
│    - Select bus                                     │
│    - Select route                                   │
│    - Set departure time                             │
│    - Set operating days (Mon-Sun bitmask)           │
│    - Set base fare                                  │
├──────────────────────────────────────────────────────┤
│ 2. View all schedules (GET /schedules/own)          │
│    - Filter by status, date range                   │
├──────────────────────────────────────────────────────┤
│ 3. Update schedule (PATCH /schedules/:id)           │
│    - Modify departure time, fare, operating days    │
├──────────────────────────────────────────────────────┤
│ 4. Deactivate schedule (PATCH /schedules/:id)       │
│    - Mark isActive = false                          │
└──────────────────────────────────────────────────────┘
```

#### 5.1.4 View Bookings
```
┌──────────────────────────────────────────────────────┐
│ 1. View all bookings for owned buses                │
│    - Filter by date, status, schedule               │
│    - Show: Customer name, seats, fare, status       │
├──────────────────────────────────────────────────────┤
│ 2. Booking statuses:                                │
│    - PENDING_PAYMENT                                │
│    - CONFIRMED                                      │
│    - CANCELLED                                      │
│    - COMPLETED                                      │
└──────────────────────────────────────────────────────┘
```

### 5.2 Conductor Workflows

#### 5.2.1 Register as Conductor
```
┌──────────────────────────────────────────────────────┐
│ 1. Navigate to "Register as Conductor" (during signup)│
├──────────────────────────────────────────────────────┤
│ 2. Enter personal details:                          │
│    - First Name                                     │
│    - Last Name                                      │
│    - License Number                                 │
│    - License Expiry Date (date picker)              │
│    - Contact Number                                 │
├──────────────────────────────────────────────────────┤
│ 3. Upload license document (image/PDF)              │
│    - Status: isLicenseVerified = false (pending)    │
│    - Admin approval required                        │
├──────────────────────────────────────────────────────┤
│ 4. Profile set to pending verification              │
│    - Show status badge: "Pending Verification"      │
└──────────────────────────────────────────────────────┘
```

#### 5.2.2 View Assigned Buses
```
┌──────────────────────────────────────────────────────┐
│ 1. Access "My Buses" screen                         │
│    (GET /conductor/me/buses)                        │
├──────────────────────────────────────────────────────┤
│ 2. Display:                                         │
│    - Bus registration number                       │
│    - Bus model & year                               │
│    - Total seats & seat layout                      │
│    - Current schedules                              │
│    - Assignment start date                          │
├──────────────────────────────────────────────────────┤
│ 3. Tap a bus to view:                               │
│    - Detailed schedule                              │
│    - Upcoming trips                                 │
│    - Passenger manifest (when trip date arrives)    │
└──────────────────────────────────────────────────────┘
```

#### 5.2.3 Check Trip Schedule
```
┌──────────────────────────────────────────────────────┐
│ 1. Select bus → View schedules                      │
├──────────────────────────────────────────────────────┤
│ 2. Show schedule details:                           │
│    - Route (from → to)                              │
│    - Departure time                                 │
│    - Operating days (Mon-Sun indicators)            │
│    - Base fare                                      │
├──────────────────────────────────────────────────────┤
│ 3. For upcoming trip date:                          │
│    - Show passenger list                           │
│    - Show booked seats                              │
│    - Show passenger contact info                    │
└──────────────────────────────────────────────────────┘
```

#### 5.2.4 Update Profile
```
┌──────────────────────────────────────────────────────┐
│ 1. Access "My Profile" screen                       │
├──────────────────────────────────────────────────────┤
│ 2. Editable fields:                                 │
│    - First Name                                     │
│    - Last Name                                      │
│    - Contact Number                                 │
│    - Address (if added)                             │
├──────────────────────────────────────────────────────┤
│ 3. Non-editable fields:                             │
│    - License Number                                 │
│    - License Status                                 │
│    - License Verification Badge                     │
├──────────────────────────────────────────────────────┤
│ 4. PATCH /conductor/me                              │
└──────────────────────────────────────────────────────┘
```

---

## 6. API Endpoints Reference

### 6.1 Bus Owner Endpoints

#### 6.1.1 Profile Management
- **POST** `/bus-owner/register` - Register as bus owner
- **GET** `/bus-owner/me` - Get own profile (Roles: BusOwner)
- **PATCH** `/bus-owner/me` - Update profile (Roles: BusOwner)

#### 6.1.2 Bus Management
- **POST** `/buses` - Register a new bus (Roles: BusOwner)
- **GET** `/buses` - List own buses (Roles: BusOwner)
  - Query Params: `status=PENDING|APPROVED|REJECTED`
- **GET** `/buses/:id` - Get bus details (Roles: BusOwner)
- **PATCH** `/buses/:id` - Update bus (only PENDING/REJECTED status) (Roles: BusOwner)

#### 6.1.3 Bus Documents
- **POST** `/buses/:id/documents` - Upload document (Roles: BusOwner)
  - Body: `{ "documentType": "RC|INSURANCE|ROADWORTHINESS", "fileData": "base64" }`
- **GET** `/buses/:id/documents` - List documents (Roles: BusOwner)
- **GET** `/buses/:id/documents/:docId` - Get single document (Roles: BusOwner)

#### 6.1.4 Conductor Management (Assign/Unassign)
- **GET** `/buses/:id/conductors` - List assigned conductors (Roles: BusOwner)
- **POST** `/buses/:id/conductors/:conductorId` - Assign conductor (Roles: BusOwner)
- **DELETE** `/buses/:id/conductors/:conductorId` - Unassign conductor (Roles: BusOwner)

#### 6.1.5 Schedule Management
- **POST** `/schedules` - Create schedule (Roles: BusOwner)
  - Body: `{ "busId", "routeId", "departureTime", "operatingDays", "baseFare" }`
- **GET** `/schedules/own` - Get own schedules (Roles: BusOwner)
- **GET** `/schedules/:id` - Get schedule details (Roles: BusOwner)
- **PATCH** `/schedules/:id` - Update schedule (Roles: BusOwner)
- **DELETE** `/schedules/:id` - Deactivate schedule (Roles: BusOwner)

#### 6.1.6 Booking Management
- **GET** `/bookings/own` - View bookings for own buses (Roles: BusOwner)
  - Query: `?scheduleId=xxx&status=CONFIRMED&date=2024-12-15`
- **GET** `/bookings/:id` - Get booking details (Roles: BusOwner)

#### 6.1.7 Route Management
- **GET** `/routes` - List available routes

### 6.2 Conductor Endpoints

#### 6.2.1 Profile Management
- **POST** `/conductor` - Register as conductor (during signup)
- **GET** `/conductor/:id` - Get conductor profile (public)
- **PATCH** `/conductor/:id` - Update profile (Roles: Conductor)

#### 6.2.2 Bus Management
- **GET** `/conductor/me/buses` - List assigned buses (Roles: Conductor)

### 6.3 Public/Shared Endpoints

#### 6.3.1 Routes
- **GET** `/routes` - List all routes
- **GET** `/routes/:id` - Get route details

#### 6.3.2 Search & Discovery
- **GET** `/search/trips` - Search available trips
  - Query: `?from=RouteID&to=RouteID&date=2024-12-15&passengers=2`

---

## 7. Data Models & Kotlin Classes

### 7.1 User-related Models

```kotlin
// User.kt
data class User(
    val id: String,
    val email: String,
    val phone: String,
    val isVerified: Boolean,
    val createdAt: String,
    val updatedAt: String
)

// LoginResponse.kt
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val role: UserRole,
    val email: String,
    val phone: String
)

// LoginRequest.kt
data class LoginRequest(
    val username: String,  // email or phone
    val password: String
)

enum class UserRole {
    BusOwner,
    Conductor,
    Customer,
    Admin
}
```

### 7.2 Bus Owner Models

```kotlin
// BusOwner.kt
data class BusOwner(
    val id: String,
    val firstName: String,
    val lastName: String,
    val contactNumber: String,
    val nicNumber: String,  // National ID
    val address: String,
    val user: User
)

// CreateBusOwnerRequest.kt
data class CreateBusOwnerRequest(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
    val contactNumber: String,
    val nicNumber: String,
    val address: String
)
```

### 7.3 Bus Models

```kotlin
// Bus.kt
data class Bus(
    val id: String,
    val registrationNumber: String,
    val model: String,
    val year: Int,
    val totalSeats: Int,
    val seatLayoutJson: SeatLayout,
    val approvalStatus: ApprovalStatus,
    val rejectionReason: String?,
    val owner: BusOwner,
    val documents: List<BusDocument>,
    val createdAt: String,
    val updatedAt: String
)

// SeatLayout.kt
data class SeatLayout(
    val rows: Int,
    val columns: Int,
    val seats: List<Seat>? = null
)

data class Seat(
    val seatNumber: String,
    val row: Int,
    val col: Int
)

// CreateBusRequest.kt
data class CreateBusRequest(
    val registrationNumber: String,
    val model: String,
    val year: Int,
    val totalSeats: Int,
    val seatLayoutJson: SeatLayout
)

// ApprovalStatus.kt
enum class ApprovalStatus {
    PENDING,
    APPROVED,
    REJECTED
}

// BusDocument.kt
data class BusDocument(
    val id: String,
    val busId: String,
    val documentType: String,  // RC, INSURANCE, ROADWORTHINESS
    val fileData: String?,  // base64 (when fetching single doc)
    val uploadedAt: String
)

// UploadDocumentRequest.kt
data class UploadDocumentRequest(
    val documentType: String,
    val fileData: String  // base64 encoded
)
```

### 7.4 Conductor Models

```kotlin
// Conductor.kt
data class Conductor(
    val id: String,
    val firstName: String,
    val lastName: String,
    val licenseNumber: String,
    val licenseExpiryDate: String,  // ISO date
    val licenseDoc: String,
    val contactNumber: String,
    val isLicenseVerified: Boolean,
    val user: User
)

// CreateConductorRequest.kt
data class CreateConductorRequest(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
    val licenseNumber: String,
    val licenseExpiryDate: String,
    val licenseDoc: String,  // base64
    val contactNumber: String
)

// AssignmentDto.kt
data class BusAssignment(
    val id: String,
    val busId: String,
    val conductorId: String,
    val conductor: Conductor,
    val assignmentStartDate: String,
    val assignmentEndDate: String?,
    val isActive: Boolean
)
```

### 7.5 Schedule Models

```kotlin
// Schedule.kt
data class Schedule(
    val id: String,
    val busId: String,
    val routeId: String,
    val departureTime: String,  // HH:mm format
    val operatingDays: Int,  // Bitmask: 0b1111111 = Mon-Sun
    val baseFare: Double,
    val isActive: Boolean,
    val createdAt: String
)

// CreateScheduleRequest.kt
data class CreateScheduleRequest(
    val busId: String,
    val routeId: String,
    val departureTime: String,
    val operatingDays: Int,
    val baseFare: Double
)
```

### 7.6 Booking Models

```kotlin
// Booking.kt
data class Booking(
    val id: String,
    val customerId: String,
    val scheduleId: String,
    val tripDate: String,  // YYYY-MM-DD
    val seatNumbers: List<String>,
    val totalFare: Double,
    val discountAmount: Double,
    val couponId: String?,
    val status: BookingStatus,
    val bookedAt: String,
    val cancelledAt: String?
)

enum class BookingStatus {
    PENDING_PAYMENT,
    CONFIRMED,
    CANCELLED,
    COMPLETED
}
```

### 7.7 Route Models

```kotlin
// Route.kt
data class Route(
    val id: String,
    val startLocation: String,
    val endLocation: String,
    val distance: Double,
    val estimatedDuration: Int,  // minutes
    val createdAt: String
)
```

### 7.8 Generic API Response

```kotlin
// ApiResponse.kt
data class ApiResponse<T>(
    val success: Boolean,
    val message: String,
    val statusCode: Int = 200,
    val data: T? = null
)

// PaginatedResponse.kt
data class PaginatedResponse<T>(
    val items: List<T>,
    val totalCount: Int,
    val page: Int,
    val pageSize: Int,
    val totalPages: Int
)
```

---

## 8. UI Screens & Navigation

### 8.1 Navigation Graph (using Jetpack Navigation)

```
Login Screen
    ↓ (if register)
→ Register Role Selection (Bus Owner / Conductor)
    ↓
→ Bus Owner Registration / Conductor Registration
    ↓ (success)
→ Dashboard
    ├─ Bus Owner Dashboard
    │   ├─ Home (Fleet Overview)
    │   ├─ Register Bus
    │   ├─ Bus Management
    │   │   ├─ Bus List
    │   │   ├─ Bus Details
    │   │   ├─ Upload Documents
    │   │   ├─ Assign Conductors
    │   │   └─ Manage Schedules
    │   ├─ Bookings
    │   ├─ Settings
    │   └─ Profile
    │
    └─ Conductor Dashboard
        ├─ Home (My Buses)
        ├─ My Buses
        │   ├─ Bus List
        │   ├─ Bus Details
        │   └─ Schedule & Passenger Manifest
        ├─ Settings
        └─ Profile
```

### 8.2 Key UI Screens Breakdown

#### 8.2.1 Login/Registration Flow

**Login Screen:**
- Email/Phone input field
- Password input field
- "Remember me" checkbox
- Login button
- "Don't have account?" → Register link
- "Forgot password?" link

**Registration Selection:**
- Two buttons: "Register as Bus Owner" / "Register as Conductor"
- Back button

**Bus Owner Registration:**
- First Name
- Last Name
- Email
- Phone
- Password (with strength indicator)
- NIC Number
- Address (multiline)
- Accept Terms checkbox
- Register button

**Conductor Registration:**
- First Name
- Last Name
- Email
- Phone
- Password
- License Number
- License Expiry Date (date picker)
- License Document (camera/gallery upload)
- Contact Number
- Register button

#### 8.2.2 Bus Owner Dashboard

**Home/Fleet Overview:**
- Welcome message
- Quick stats:
  - Total buses
  - Active schedules
  - Pending bookings
  - Conductors assigned
- Action buttons:
  - Register New Bus
  - View Schedules
  - Manage Conductors
- Recent activity feed

**Register Bus Screen:**
- Registration Number (text input)
- Model (dropdown/search)
- Year (number picker)
- Total Seats (number picker)
- Seat Layout Configuration:
  - Rows (number input)
  - Columns (number input)
  - Visual seat layout preview
- Proceed to Documents button

**Upload Documents:**
- Three document types (tabs):
  - Registration Certificate (RC)
  - Insurance Certificate
  - Roadworthiness Certificate
- File upload buttons (camera/gallery)
- Preview of uploaded documents
- Submit for Approval button
- Status badge: PENDING → APPROVED/REJECTED

**Bus List Screen:**
- List of buses (RecyclerView)
- Each item shows:
  - Registration number
  - Model & year
  - Total seats
  - Approval status (badge)
  - Assigned conductors count
- Filter by status (All/Pending/Approved/Rejected)
- Search by registration number
- Tap to view details / Edit / Manage Conductors

**Bus Details & Edit:**
- Display bus information
- Edit form (only if PENDING or REJECTED)
- Documents section (view/reupload)
- Assigned Conductors list
  - Show conductor details
  - Option to unassign
  - Add new conductor button

**Assign Conductor Screen:**
- Search/filter available conductors
- Show conductor:
  - Name
  - License number
  - Verification status (badge)
  - Contact info
- Assign button
- Confirmation dialog

**Schedule Management:**
- Create Schedule form:
  - Bus selector (dropdown)
  - Route selector (search)
  - Departure time (time picker)
  - Operating days (checkboxes: Mon-Sun)
  - Base fare (decimal input)
  - Create button
- Schedule list (RecyclerView):
  - Route (From → To)
  - Departure time
  - Operating days indicators
  - Base fare
  - Active/Inactive toggle
  - Edit/Delete options

**Bookings View:**
- List of bookings for own buses
- Filter options:
  - By date range
  - By status
  - By bus
- Each booking shows:
  - Customer name
  - Bus & route
  - Trip date
  - Seats booked
  - Fare
  - Status
- Tap to view passenger details

#### 8.2.3 Conductor Dashboard

**Home Screen:**
- Welcome message
- License verification status (prominent badge)
- Quick stats:
  - Buses assigned: X
  - Upcoming trips: X
  - Profile completion: Y%
- Assigned buses list (quick preview)
- Action buttons:
  - View All Buses
  - Edit Profile
  - View Schedule

**My Buses Screen:**
- List of assigned buses
- Each item shows:
  - Registration number
  - Model & year
  - Seats
  - Assignment start date
  - Badge: "Active"/"Unassigned"
- Tap to view bus details

**Bus Details Screen:**
- Bus information
- Current schedules
- Next upcoming trip:
  - Route
  - Date & departure time
  - Passenger manifest link

**Schedule & Manifest Screen:**
- Schedule details
- For selected trip date:
  - Passenger list (RecyclerView):
    - Passenger name
    - Booked seats
    - Contact number
    - Booking status
  - Total passengers / Available seats indicator
- Print manifest option

**Profile Screen:**
- Display profile information
- Editable fields:
  - First name
  - Last name
  - Contact number
  - Address (if added)
- Non-editable (info only):
  - License number
  - License expiry date
  - License status badge
  - Verification date (if verified)
- Edit button → Edit form with save
- Change password option
- Logout button

#### 8.2.4 Settings Screen (Both Roles)

- Notification preferences
- Language selection
- Dark mode toggle
- About app
- Version info
- Legal (Terms, Privacy Policy)
- Contact support
- Logout button

---

## 9. Security Requirements

### 9.1 Authentication & Authorization

- ✅ Use Bearer token authentication (JWT)
- ✅ Store access token in memory (short-lived: 15-60 minutes)
- ✅ Store refresh token securely in DataStore (encrypted)
- ✅ Implement token refresh logic (before expiration or on 401 response)
- ✅ Validate JWT signature on client-side (optional, for UX)
- ✅ Clear tokens on logout
- ✅ Clear tokens on app uninstall/data clear

### 9.2 Network Security

- ✅ Use HTTPS only (enforce SSL/TLS)
- ✅ Implement certificate pinning (optional, for production)
- ✅ Add request signing if required by backend
- ✅ Implement timeout (30 seconds default)
- ✅ Retry logic with exponential backoff
- ✅ Request throttling for login attempts (client-side)

### 9.3 Data Protection

- ✅ Don't store sensitive data in logs
- ✅ Use encrypted SharedPreferences/DataStore for tokens
- ✅ Don't hardcode API URLs or keys
- ✅ Use BuildConfig for environment variables
- ✅ Encrypt local database (Room with SQLCipher optional)
- ✅ Clear sensitive data from memory after use

### 9.4 Input Validation

- ✅ Validate email format
- ✅ Validate phone number format (local: +94...)
- ✅ Validate password strength (min 8 chars, uppercase, lowercase, digit, special)
- ✅ Validate numeric inputs (year, seats, fare, etc.)
- ✅ Validate file uploads (type, size < 10MB)
- ✅ Sanitize user input before display (prevent XSS)

### 9.5 Error Handling

- ✅ Don't expose backend error details to user
- ✅ Log errors securely (exclude sensitive data)
- ✅ Show user-friendly error messages
- ✅ Implement proper error retry logic

---

## 10. Local Database Schema (Room)

### 10.1 Database Structure

```kotlin
@Database(
    entities = [
        UserEntity::class,
        BusOwnerEntity::class,
        ConductorEntity::class,
        BusEntity::class,
        ScheduleEntity::class,
        BookingEntity::class
    ],
    version = 1
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun busOwnerDao(): BusOwnerDao
    abstract fun busDao(): BusDao
    // ... other DAOs
}

// UserEntity.kt
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val email: String,
    val phone: String?,
    val isVerified: Boolean,
    val createdAt: String,
    val updatedAt: String
)

// BusOwnerEntity.kt
@Entity(tableName = "bus_owners")
data class BusOwnerEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val firstName: String,
    val lastName: String,
    val contactNumber: String,
    val nicNumber: String,
    val address: String,
    @ForeignKey(entity = UserEntity::class, parentColumns = ["id"], childColumns = ["userId"])
    val user: UserEntity
)

// BusEntity.kt
@Entity(
    tableName = "buses",
    foreignKeys = [
        ForeignKey(entity = BusOwnerEntity::class, parentColumns = ["id"], childColumns = ["ownerId"])
    ]
)
data class BusEntity(
    @PrimaryKey val id: String,
    val ownerId: String,
    val registrationNumber: String,
    val model: String,
    val year: Int,
    val totalSeats: Int,
    val seatLayoutJson: String,  // JSON string
    val approvalStatus: String,
    val rejectionReason: String?,
    val createdAt: String,
    val updatedAt: String
)

// ScheduleEntity.kt
@Entity(
    tableName = "schedules",
    foreignKeys = [
        ForeignKey(entity = BusEntity::class, parentColumns = ["id"], childColumns = ["busId"]),
        ForeignKey(entity = RouteEntity::class, parentColumns = ["id"], childColumns = ["routeId"])
    ]
)
data class ScheduleEntity(
    @PrimaryKey val id: String,
    val busId: String,
    val routeId: String,
    val departureTime: String,
    val operatingDays: Int,
    val baseFare: Double,
    val isActive: Boolean,
    val createdAt: String
)
```

### 10.2 DataStore Preferences

```kotlin
// DataStoreManager.kt
class DataStoreManager(context: Context) {
    private val dataStore = context.createDataStore("app_settings")
    
    companion object {
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val USER_ROLE = stringPreferencesKey("user_role")
        val LAST_LOGIN = longPreferencesKey("last_login")
    }
    
    suspend fun saveTokens(accessToken: String, refreshToken: String) { }
    suspend fun getAccessToken(): String? { }
    suspend fun clearAll() { }
}
```

---

## 11. Testing Strategy

### 11.1 Unit Testing

**Test framework:** JUnit 4 + Mockito

```kotlin
// AuthServiceTest.kt
class AuthServiceTest {
    @Test
    fun testLoginSuccess() { }
    
    @Test
    fun testLoginInvalidCredentials() { }
    
    @Test
    fun testTokenRefresh() { }
}

// BusServiceTest.kt
class BusServiceTest {
    @Test
    fun testRegisterBusSuccess() { }
    
    @Test
    fun testRegisterBusValidationError() { }
}
```

### 11.2 Integration Testing

```kotlin
// LoginFlowTest.kt
class LoginFlowTest {
    @Test
    fun testCompleteLoginFlow() {
        // 1. Call login API
        // 2. Verify tokens saved
        // 3. Verify navigation
    }
}

// BusManagementFlowTest.kt
class BusManagementFlowTest {
    @Test
    fun testRegisterBusAndAssignConductor() {
        // 1. Register bus
        // 2. Verify status = PENDING
        // 3. Upload documents
        // 4. Assign conductor
    }
}
```

### 11.3 UI Testing (Espresso)

```kotlin
// LoginScreenTest.kt
class LoginScreenTest {
    @Test
    fun testLoginScreenLayout() {
        onView(withId(R.id.emailInput)).check(matches(isDisplayed()))
        onView(withId(R.id.passwordInput)).check(matches(isDisplayed()))
    }
    
    @Test
    fun testLoginSuccess() {
        // 1. Enter credentials
        // 2. Click login
        // 3. Verify navigation to dashboard
    }
}
```

### 11.4 Test Coverage Goals

- ✅ Minimum 70% code coverage
- ✅ 100% coverage for critical auth/security logic
- ✅ All API integration tests with mock server
- ✅ All UI happy paths covered

---

## 12. Performance & Optimization

### 12.1 Network Optimization

- ✅ Implement request/response caching (OkHttp interceptor)
- ✅ Cache duration: 5 min for listings, 15 min for details
- ✅ Compress images before upload (max 5MB)
- ✅ Implement pagination for lists (page size: 20)
- ✅ Lazy load images in RecyclerView
- ✅ Use ProGuard/R8 for code obfuscation

### 12.2 Database Optimization

- ✅ Create indexes on frequently queried fields
- ✅ Use Room's @Query pagination
- ✅ Implement selective sync (fetch only updated records)
- ✅ Clean up old cached data periodically

### 12.3 UI Performance

- ✅ Use ViewBinding (not findViewById)
- ✅ Use Jetpack Compose for new screens (optional)
- ✅ Implement RecyclerView with DiffUtil
- ✅ Load lists asynchronously with Coroutines
- ✅ Profile app with Android Profiler

### 12.4 Memory Management

- ✅ Use WeakReferences for context in callbacks
- ✅ Unsubscribe from LiveData/StateFlow in onDestroy
- ✅ Clear image cache on app background
- ✅ Implement proper lifecycle handling

---

## 13. Deployment & Release

### 13.1 Build Variants

```gradle
productFlavors {
    dev {
        applicationIdSuffix ".dev"
        buildConfigField "String", "API_BASE_URL", '"https://dev-api.slbus.local"'
    }
    staging {
        buildConfigField "String", "API_BASE_URL", '"https://staging-api.slbus.local"'
    }
    prod {
        buildConfigField "String", "API_BASE_URL", '"https://api.slbus.local"'
    }
}
```

### 13.2 Versioning

- Semantic versioning: MAJOR.MINOR.PATCH
- Increment PATCH for bug fixes
- Increment MINOR for new features
- Increment MAJOR for breaking changes
- Build number: auto-incremented per CI/CD

### 13.3 Release Checklist

- ✅ All tests passing
- ✅ Code review approved
- ✅ Update README & documentation
- ✅ Update changelog
- ✅ Tag release in Git
- ✅ Build signed APK/AAB
- ✅ Test on real devices (min 2 different Android versions)
- ✅ Publish to Google Play Console (internal → beta → production)
- ✅ Monitor crash reports (Firebase Crashlytics)

### 13.4 App Store Guidelines

- Target API level: 34 (Android 14)
- Min SDK: 26 (Android 8.0)
- Compile SDK: 34
- Orientation: Portrait (lock for login/registration)
- Support tablets (landscape layout optional)

---

## 14. Monitoring & Analytics

### 14.1 Crash Reporting

**Firebase Crashlytics:**
```kotlin
FirebaseCrashlytics.getInstance().recordException(exception)
```

### 14.2 Analytics Events

```kotlin
// Authentication events
logEvent("user_login", mapOf("role" to userRole))
logEvent("user_logout")

// Bus management events
logEvent("bus_registered", mapOf("registrationNumber" to busNumber))
logEvent("conductor_assigned")

// Booking events
logEvent("booking_viewed")
```

### 14.3 Performance Monitoring

- API response times
- App startup time (< 3 seconds)
- Memory usage
- Battery drain (background sync)
- Database query times

---

## 15. Appendix: API Base Setup Example

### 15.1 Retrofit Setup

```kotlin
// RetrofitClient.kt
object RetrofitClient {
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor())
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    val apiService: ApiService = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .addCallAdapterFactory(CoroutineCallAdapterFactory())
        .build()
        .create(ApiService::class.java)
}

// AuthInterceptor.kt
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val token = tokenManager.getAccessToken()
        
        val request = if (token != null) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }
        
        var response = chain.proceed(request)
        
        // Handle 401 - Token expired
        if (response.code == 401) {
            if (tokenManager.refreshAccessToken()) {
                val newToken = tokenManager.getAccessToken()
                response = chain.proceed(
                    request.newBuilder()
                        .header("Authorization", "Bearer $newToken")
                        .build()
                )
            }
        }
        
        return response
    }
}
```

### 15.2 API Service Interface

```kotlin
// ApiService.kt
interface ApiService {
    // Auth
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
    
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>
    
    @POST("auth/refresh")
    suspend fun refreshToken(): Response<RefreshTokenResponse>
    
    // Bus Owner
    @GET("bus-owner/me")
    suspend fun getBusOwnerProfile(): Response<BusOwner>
    
    @PATCH("bus-owner/me")
    suspend fun updateBusOwnerProfile(@Body request: UpdateBusOwnerRequest): Response<BusOwner>
    
    // Buses
    @POST("buses")
    suspend fun registerBus(@Body request: CreateBusRequest): Response<Bus>
    
    @GET("buses")
    suspend fun listBuses(@Query("status") status: String?): Response<List<Bus>>
    
    @GET("buses/{id}")
    suspend fun getBus(@Path("id") busId: String): Response<Bus>
    
    // ... other endpoints
}
```

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **JWT** | JSON Web Token - standard for stateless authentication |
| **Bearer Token** | Token-based authentication scheme used in HTTP Authorization header |
| **DataStore** | Android's modern replacement for SharedPreferences (encrypted, type-safe) |
| **Room** | Jetpack's local database library (abstraction over SQLite) |
| **Retrofit** | HTTP client library for Android |
| **Coroutines** | Kotlin's lightweight threading model for async operations |
| **LiveData** | Observable data holder that respects lifecycle |
| **MVVM** | Model-View-ViewModel architecture pattern |
| **DAO** | Data Access Object - database query interface |
| **DTOs** | Data Transfer Objects - JSON serializable models |
| **RecyclerView** | Efficient list/grid display component |
| **RBAC** | Role-Based Access Control |
| **HTTPS** | Secure HTTP with SSL/TLS encryption |
| **API** | Application Programming Interface |

---

## 17. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | May 19, 2026 | Backend Team | Initial comprehensive requirements document |

---

## Contact & Support

For clarifications or additional requirements:
- **Backend API Docs:** `{API_URL}/api/v1/swagger-ui`
- **Questions:** Create issue in project repository
- **Support:** Include backend API response in bug reports

---

**End of Document**
