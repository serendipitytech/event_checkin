# Expo Check-In App

A comprehensive event check-in application built with Expo and Supabase, featuring real-time synchronization, role-based access control, and robust attendee management.

## 🚀 Features

### ✅ Authentication & Security
- **Magic Link Authentication** – Secure email-based sign-in with deep linking
- **Session Management** – Automatic session restoration and persistence
- **Role-Based Access Control** – Granular permissions with role hierarchy
- **Deep Link Support** – Seamless authentication flow with `expo-checkin://auth/callback`

### ✅ Real-Time Synchronization
- **Multi-Device Sync** – Real-time attendee updates across all connected devices
- **Robust Connection Management** – Automatic reconnection with exponential backoff
- **Connection Monitoring** – Status indicators and error handling
- **Channel Management** – Proper cleanup and subscription lifecycle

### ✅ Attendee Management
- **Check-In Interface** – Intuitive swipe and tap interactions
- **Bulk Operations** – Group and table-based check-ins
- **Search & Filter** – Find attendees quickly with real-time search
- **Status Tracking** – Visual indicators for pending and checked-in attendees

### ✅ Roster Import System
- **CSV File Import** – File picker with configurable column mapping
- **Google Sheets Integration** – Direct URL import with CSV conversion
- **Bulk Operations** – Efficient Supabase upsert with error reporting
- **Import Validation** – File format validation and error feedback

### ✅ Admin Onboarding
- **Event Creation** – Complete event setup with organization management
- **User Invitations** – Role-based invitation system with email notifications
- **Permission Management** – Assign roles and manage team access
- **Guided Workflows** – Step-by-step onboarding for new events

## 🏗️ Architecture

### Core Services
- **`services/supabase.ts`** – Supabase client singleton with auth configuration
- **`services/auth.ts`** – Magic link authentication and deep link handling
- **`services/permissions.ts`** – Role-based access control and permission helpers
- **`services/realtime.ts`** – Enhanced real-time subscription management
- **`services/eventManagement.ts`** – Event creation, user invitations, and role management
- **`services/rosterImport.ts`** – CSV and Google Sheets import functionality

### UI Components
- **`components/RosterImportModal.tsx`** – File picker and Google Sheets import UI
- **`components/CreateEventModal.tsx`** – Event creation with organization setup
- **`components/InviteUserModal.tsx`** – User invitation with role selection

### Hooks
- **`hooks/useSupabase.ts`** – Supabase context wrapper
- **`hooks/usePermissions.ts`** – Role-based permission checks
- **`hooks/useRealtime.ts`** – Real-time connection status monitoring

## 🎯 Role Hierarchy

The app implements a comprehensive role-based access control system:

1. **Owner** – Full access to all features including organization management
2. **Admin** – Can manage events, invite users, and manage attendees
3. **Manager** – Can manage attendees and perform check-ins
4. **Checker** – Can only perform check-ins
5. **Member** – Basic access to view event information

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Expo CLI (`npm install -g @expo/cli`)
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd expo-checkin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase**
   - Create a new Supabase project
   - Run the SQL schema from `checkin_supabase_initial.sql`
   - Set up Row Level Security (RLS) policies
   - Configure authentication settings

4. **Set up environment variables**
   ```bash
   # Create .env file
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

### Database Setup

The app requires a Supabase database with the following tables:
- `organizations` – Organization management
- `events` – Event information and settings
- `attendees` – Attendee roster and check-in status
- `event_invites` – User invitation system
- `user_roles` – Role-based access control

See `checkin_supabase_initial.sql` for the complete schema and RLS policies.

## 📱 Usage

### For Event Organizers

1. **Sign In** – Use magic link authentication to sign in
2. **Create Event** – Set up new events with organization details
3. **Invite Team** – Send role-based invitations to collaborators
4. **Import Roster** – Upload CSV files or sync Google Sheets
5. **Manage Check-ins** – Monitor real-time attendee status

### For Check-in Staff

1. **Sign In** – Access with invited credentials
2. **Select Event** – Choose from available events
3. **Check In Attendees** – Use swipe gestures or tap interactions
4. **Bulk Operations** – Check in entire groups or tables
5. **Real-time Updates** – See changes from other devices instantly

## 🔧 Configuration

### Supabase Configuration

The app requires the following Supabase setup:

1. **Authentication**
   - Enable email authentication
   - Configure redirect URLs for deep linking
   - Set up email templates for magic links

2. **Database Functions**
   - `get_my_access()` – Returns user's accessible events and roles
   - `toggle_checkin()` – Updates attendee check-in status
   - `bulk_checkin_by_group()` – Bulk check-in by group
   - `bulk_checkin_by_table()` – Bulk check-in by table
   - `create_event_with_org()` – Creates event with organization
   - `invite_user_to_event()` – Sends user invitations

3. **Row Level Security**
   - Policies for organizations, events, and attendees
   - Role-based access control at the database level
   - Secure user data isolation

### Deep Linking

Configure deep linking for authentication:
- **iOS**: Add URL scheme `expo-checkin` to `app.json`
- **Android**: Configure intent filters for `expo-checkin://auth/callback`

## 🧪 Testing

### Manual Testing
1. **Authentication Flow** – Test magic link sign-in and deep linking
2. **Role Permissions** – Verify role-based access restrictions
3. **Real-time Sync** – Test multi-device synchronization
4. **Import Functionality** – Test CSV and Google Sheets import
5. **Error Handling** – Test network failures and error recovery

### Automated Testing
- Unit tests for permission helpers
- Integration tests for Supabase operations
- E2E tests for critical user flows

## 🚀 Deployment

### Development
```bash
npm start
```

### Production Build
```bash
# iOS
npx expo build:ios

# Android
npx expo build:android
```

### Environment Variables
Ensure production environment variables are configured:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 📚 Documentation

- **Integration Plan** – See `docs/supabase-integration-plan.md`
- **API Documentation** – Supabase functions and RPCs
- **Component Documentation** – UI component usage and props

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in the `docs/` folder
- Review the Supabase integration plan
- Open an issue for bugs or feature requests

---

**Built with ❤️ using Expo, React Native, and Supabase**