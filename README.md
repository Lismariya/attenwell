# AttenWell

**AttenWell** is a comprehensive suite of engaging mini-games and tools designed to help children, particularly those with ADHD, improve their cognitive skills. By turning focus, attention, and memory exercises into fun, rewarding activities, AttenWell helps kids build essential skills in a playful environment.

## 🚀 Features

### 🎮 Engaging Mini-Games
- **Noise Ninjas**: Focus on specific sounds amidst background noise to improve auditory attention.
- **Track the Ball**: Follow moving targets to enhance visual tracking and sustained attention.
- **Catch the Right One**: React quickly to specific targets while ignoring distractions.
- **Memory Match**: A classic memory booster involving finding pairs of cards.
- **Hit the Monster**: Improve reaction time and inhibitory control by tapping monsters and avoiding friendly characters.
- **Jigsaw Puzzle**: Strengthen problem-solving and spatial reasoning skills.

### 🧘 Wellness & Focus Tools
- **Guided Meditation**: Built-in sessions to help children find calm and practice mindfulness.
- **Smart Focus Sessions**: A specialized timer that uses AI-powered face detection to ensure children stay on task, providing gentle warnings if they lose focus.

### 📊 Parent's Dashboard
- **Progress Tracking**: Monitor your child's improvement across various cognitive skills (Attention, Memory, etc.).
- **Weekly Progress Snapshots**: Capture skill scores weekly with a smart countdown timer.
- **Skill Comparison**: Toggle between Overall, Current Week, and Previous Week data.
- **Feedback Notes**: Record observations and milestones directly in the app.
- **Secure Access**: Protected by a 4-digit PIN to ensure privacy.

### 🐰 AI Assistant
- **Cloud Assistant**: A friendly animated assistant that lives in a floating cloud bubble, suggesting the next "Adventure" based on your child's progress.

## 🛠️ Tech Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & ShadCN UI
- **Backend/Auth**: Firebase (Firestore, Authentication)
- **AI**: Genkit & Face-API.js

## 🚦 Getting Started

1. **Setup Firebase**: Connect your own Firebase project and update `src/firebase/config.ts`.
2. **Install Dependencies**: 
   ```bash
   npm install
   ```
3. **Run Locally**:
   ```bash
   npm run dev
   ```

## 📦 Pushing to GitHub

If you encounter a `[rejected] main -> main (fetch first)` error, it means GitHub has changes you don't have locally. Run these commands to sync:

```bash
git pull origin main --rebase
git push origin main
```

If the branches are completely unrelated (e.g., a new repo with a README), use:
```bash
git pull origin main --allow-unrelated-histories
git push origin main
```
