import React, { useRef, useState, useCallback, useEffect } from 'react';

// Game settings
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
const BALL_SPEED = 4;

// Game interfaces
interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

interface Paddle {
  x: number;
  y: number;
}

interface GameState {
  leftPaddle: Paddle;
  rightPaddle: Paddle;
  ball: Ball;
  leftScore: number;
  rightScore: number;
  isPlaying: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Paddle Component
const PaddleComponent: React.FC<{ 
  paddle: Paddle; 
  isLeft: boolean;
}> = ({ paddle, isLeft }) => (
  <div
    className={`absolute bg-foreground rounded-sm ${isLeft ? 'left-4' : 'right-4'}`}
    style={{
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      top: paddle.y,
      left: isLeft ? 16 : undefined,
      right: isLeft ? undefined : 16,
    }}
  />
);

// Ball Component
const BallComponent: React.FC<{ ball: Ball }> = ({ ball }) => (
  <div
    className="absolute bg-foreground rounded-full"
    style={{
      width: BALL_SIZE,
      height: BALL_SIZE,
      left: ball.x - BALL_SIZE / 2,
      top: ball.y - BALL_SIZE / 2,
    }}
  />
);

// Score Display
const ScoreDisplay: React.FC<{ 
  leftScore: number; 
  rightScore: number; 
  difficulty: string;
}> = ({ leftScore, rightScore, difficulty }) => (
  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 text-center">
    <div className="text-5xl font-bold text-primary mb-3 tracking-wider">
      {leftScore} - {rightScore}
    </div>
    <div className="text-lg font-semibold text-muted-foreground capitalize bg-secondary/20 px-4 py-1 rounded-full">
      {difficulty} AI
    </div>
  </div>
);

// Difficulty Controls
const DifficultyControls: React.FC<{
  isPlaying: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  onStart: () => void;
  onReset: () => void;
  onDifficultyChange: (difficulty: 'easy' | 'medium' | 'hard') => void;
}> = ({ isPlaying, difficulty, onStart, onReset, onDifficultyChange }) => (
  <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center space-y-6">
    {!isPlaying && (
      <div className="space-y-4">
        <div className="text-lg font-semibold text-foreground mb-3">Choose Difficulty</div>
        <div className="flex gap-3">
          {(['easy', 'medium', 'hard'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onDifficultyChange(level)}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                difficulty === level
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-102'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
    )}
    
    <button
      onClick={isPlaying ? onReset : onStart}
      className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
    >
      {isPlaying ? 'Reset Game' : 'Start Game'}
    </button>
    
    {!isPlaying && (
      <div className="text-sm text-muted-foreground space-y-2 bg-card/50 p-4 rounded-lg border">
        <div className="font-semibold text-foreground mb-2">Controls:</div>
        <div>🎮 W / S keys to move paddle</div>
        <div>🤖 AI controls right paddle</div>
        <div>🎯 First to 11 points wins!</div>
      </div>
    )}
  </div>
);

// Main Pong Component
const Pong: React.FC<{ width?: string; height?: string; className?: string }> = ({ 
  width = "100%", 
  height = "100vh", 
  className = "" 
}) => {
  const gameRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const [gameState, setGameState] = useState<GameState>({
    leftPaddle: { x: 0, y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    rightPaddle: { x: GAME_WIDTH - PADDLE_WIDTH, y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    ball: { 
      x: GAME_WIDTH / 2, 
      y: GAME_HEIGHT / 2, 
      velocityX: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1), 
      velocityY: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1) 
    },
    leftScore: 0,
    rightScore: 0,
    isPlaying: false,
    difficulty: 'medium'
  });

  // Reset ball to center
  const resetBall = useCallback(() => {
    return {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      velocityX: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
      velocityY: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1)
    };
  }, []);

  // Check collision between ball and paddle
  const checkPaddleCollision = (ball: Ball, paddle: Paddle, isLeft: boolean): boolean => {
    const paddleLeft = isLeft ? paddle.x : paddle.x;
    const paddleRight = isLeft ? paddle.x + PADDLE_WIDTH : paddle.x + PADDLE_WIDTH;
    const paddleTop = paddle.y;
    const paddleBottom = paddle.y + PADDLE_HEIGHT;

    return ball.x - BALL_SIZE / 2 < paddleRight &&
           ball.x + BALL_SIZE / 2 > paddleLeft &&
           ball.y - BALL_SIZE / 2 < paddleBottom &&
           ball.y + BALL_SIZE / 2 > paddleTop;
  };

  // AI paddle logic with difficulty levels
  const updateAIPaddle = (ball: Ball, paddle: Paddle, difficulty: 'easy' | 'medium' | 'hard'): Paddle => {
    const paddleCenter = paddle.y + PADDLE_HEIGHT / 2;
    const diff = ball.y - paddleCenter;
    
    // Difficulty-based speed multipliers
    const difficultyMultipliers = {
      easy: 0.6,
      medium: 0.8,
      hard: 1.0
    };
    
    const baseSpeed = PADDLE_SPEED * difficultyMultipliers[difficulty];
    const speed = Math.min(baseSpeed, Math.abs(diff));
    
    // Difficulty-based reaction threshold
    const reactionThreshold = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 15 : 5;
    
    if (Math.abs(diff) > reactionThreshold) {
      return {
        ...paddle,
        y: Math.max(0, Math.min(GAME_HEIGHT - PADDLE_HEIGHT, 
          paddle.y + (diff > 0 ? speed : -speed)
        ))
      };
    }
    return paddle;
  };

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.isPlaying) return;

    setGameState(prevState => {
      let newState = { ...prevState };
      
      // Update paddles
      const leftPaddleSpeed = (keysRef.current['KeyW'] ? -PADDLE_SPEED : 0) + 
                             (keysRef.current['KeyS'] ? PADDLE_SPEED : 0);
      
      newState.leftPaddle.y = Math.max(0, Math.min(GAME_HEIGHT - PADDLE_HEIGHT, 
        newState.leftPaddle.y + leftPaddleSpeed
      ));

      // AI controls right paddle
      newState.rightPaddle = updateAIPaddle(newState.ball, newState.rightPaddle, newState.difficulty);

      // Update ball
      newState.ball.x += newState.ball.velocityX;
      newState.ball.y += newState.ball.velocityY;

      // Ball collision with top/bottom walls
      if (newState.ball.y <= BALL_SIZE / 2 || newState.ball.y >= GAME_HEIGHT - BALL_SIZE / 2) {
        newState.ball.velocityY *= -1;
      }

      // Ball collision with paddles
      if (checkPaddleCollision(newState.ball, newState.leftPaddle, true) ||
          checkPaddleCollision(newState.ball, newState.rightPaddle, false)) {
        newState.ball.velocityX *= -1;
        // Add some randomness to prevent boring gameplay
        newState.ball.velocityY += (Math.random() - 0.5) * 2;
      }

      // Scoring
      if (newState.ball.x < 0) {
        newState.rightScore++;
        newState.ball = resetBall();
      } else if (newState.ball.x > GAME_WIDTH) {
        newState.leftScore++;
        newState.ball = resetBall();
      }

      return newState;
    });

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, resetBall]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Start game loop
  useEffect(() => {
    if (gameState.isPlaying) {
      animationRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.isPlaying, gameLoop]);

  const handleStart = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      ball: resetBall()
    }));
  };

  const handleReset = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      leftScore: 0,
      rightScore: 0,
      leftPaddle: { x: 0, y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
      rightPaddle: { x: GAME_WIDTH - PADDLE_WIDTH, y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
      ball: resetBall()
    }));
  };

  const handleDifficultyChange = (difficulty: 'easy' | 'medium' | 'hard') => {
    setGameState(prev => ({
      ...prev,
      difficulty
    }));
  };

  return (
    <div 
      className={`flex items-center justify-center bg-background ${className}`}
      style={{ width, height }}
    >
      <div
        ref={gameRef}
        className="relative bg-card border border-border rounded-lg shadow-lg"
        style={{ 
          width: GAME_WIDTH, 
          height: GAME_HEIGHT,
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        {/* Center line */}
        <div 
          className="absolute bg-muted-foreground/30"
          style={{
            left: GAME_WIDTH / 2 - 1,
            top: 0,
            width: 2,
            height: GAME_HEIGHT,
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 10px, currentColor 10px, currentColor 20px)'
          }}
        />
        
        {/* Paddles */}
        <PaddleComponent paddle={gameState.leftPaddle} isLeft={true} />
        <PaddleComponent paddle={gameState.rightPaddle} isLeft={false} />
        
        {/* Ball */}
        {gameState.isPlaying && <BallComponent ball={gameState.ball} />}
        
        {/* Score */}
        <ScoreDisplay 
          leftScore={gameState.leftScore} 
          rightScore={gameState.rightScore}
          difficulty={gameState.difficulty}
        />
        
        {/* Controls */}
        <DifficultyControls
          isPlaying={gameState.isPlaying}
          difficulty={gameState.difficulty}
          onStart={handleStart}
          onReset={handleReset}
          onDifficultyChange={handleDifficultyChange}
        />
      </div>
    </div>
  );
};

export default Pong;