# {GAME_NAME}

A modern single-page web game built with Next.js, TypeScript, and responsive design.

## Getting Started

First, install dependencies:

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

Then, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the game.

## Features

- 🎮 Complete game in single page.tsx file
- 🎨 Beautiful responsive UI with Tailwind CSS
- ⌨️ Keyboard, mouse, and touch controls
- 🔊 Web Audio API ready
- 📱 Mobile-first responsive design
- 🎯 Score tracking and game progression
- ⚡ Optimized performance for all devices

## Architecture

This game uses a simplified single-page architecture:

- **app/page.tsx** - Contains ALL game code (state, rendering, input, UI)
- **components/ui/** - Reusable UI components (Button, Card)
- **types/game.ts** - TypeScript interfaces
- **lib/utils.ts** - Utility functions

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework
- **Canvas API** - Game rendering and graphics
- **Lucide React** - Modern icon library

## Game Controls

- **Arrow Keys / WASD**: Movement
- **Space**: Action/Jump
- **Click/Touch**: Alternative controls for mobile
- **Escape**: Pause game

## Development

This project uses:
- Single-page architecture for simplicity
- Relative imports only (no @/ paths)
- Mobile-first responsive design
- TypeScript for type safety
- ESLint for code linting

## File Structure

\`\`\`
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx           # Main game (ALL CODE HERE)
│   └── globals.css        # Responsive styles
├── components/ui/         # UI components only
│   ├── button.tsx         # Button component
│   └── card.tsx          # Card component
├── types/
│   └── game.ts           # TypeScript interfaces
├── lib/
│   └── utils.ts          # Utility functions
└── package.json          # Dependencies
\`\`\`

## Deployment

The easiest way to deploy your game is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
