# SnookerApp - Practice & Performance Tracker

A cross-platform mobile application (iOS/Android) for snooker players focused on practice routines, performance tracking, and AI-powered coaching.

## Features

### 1. Practice Routines Library
- 12+ categorized routines (Break Building, Basics, Safety Play, Straight Cueing)
- Difficulty tiers (Beginner, Intermediate, Advanced)
- Detailed setup instructions and scoring systems

### 2. Practice Session Tracker
- Create and manage practice sessions
- Track multiple routines per session
- Record scores and notes
- View progress statistics

### 3. Match Tracking
- Log matches against opponents
- Track frame scores and results
- View match history and win rates

### 4. AI Personal Coach
- Upload videos of your shots
- AI analysis of technique, alignment, and cue action
- Personalized feedback and recommendations

## Tech Stack

- **Frontend**: React Native with Expo (TypeScript)
- **Navigation**: React Navigation v6
- **State Management**: Zustand with persistence
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Offline Support**: AsyncStorage with background sync

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- iOS Simulator (Mac) or Android Emulator
- Expo Go app (for physical device testing)

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd SnookerApp/SnookerApp
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Start the development server:
```bash
npm start
```

6. Run on device:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app for physical device

## Project Structure

```
SnookerApp/
+-- src/
¦   +-- api/           # Supabase client and API calls
¦   +-- components/    # Reusable UI components
¦   +-- constants/     # App constants and theme
¦   +-- hooks/         # Custom React hooks
¦   +-- navigation/    # Navigation configuration
¦   +-- screens/       # Screen components
¦   +-- services/      # Business logic services
¦   +-- store/         # Zustand state stores
¦   +-- types/         # TypeScript types
¦   +-- utils/         # Utility functions
+-- supabase/
¦   +-- functions/     # Edge Functions
¦   +-- migrations/    # Database migrations
+-- assets/            # Images and fonts
```

## Database Setup

1. Create a new Supabase project at https://supabase.com

2. Run the migrations in the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_data.sql`

3. Configure Storage buckets:
   - Create `ai-videos` bucket (private)
   - Create `profile-images` bucket (public)

4. Enable Row Level Security (RLS) policies (already included in migrations)

## Development

### Adding a New Routine

Edit `src/constants/routines.ts` and add a new routine object to `DEFAULT_ROUTINES`:

```typescript
{
  id: 'rtn-new',
  category_id: 'cat-1',
  name: 'New Routine',
  description: 'Description here',
  difficulty: 'intermediate',
  setup_instructions: 'Setup steps...',
  scoring_type: 'points',
  max_score: 100,
  is_system_routine: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
```

### Running Tests

```bash
npm test
```

### Building for Production

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## AI Coach Architecture

The AI Coach feature uses a multi-stage pipeline:

1. **Video Upload**: User uploads video to Supabase Storage
2. **Processing Trigger**: Database trigger starts Edge Function
3. **Video Analysis**:
   - Extract keyframes from video
   - Run pose estimation (MediaPipe/OpenCV)
   - Analyze cue action metrics
4. **Feedback Generation**: LLM generates personalized feedback
5. **Results Storage**: Store analysis results in database
6. **User Notification**: Push notification when analysis is complete

### Future AI Improvements

- Real-time pose estimation during practice
- Comparative analysis with professional players
- Personalized training plan generation
- Progress tracking with AI-generated insights

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am "Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, email support@snookerapp.com or open an issue on GitHub.
