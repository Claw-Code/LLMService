// === Scripts/GameManager.cs ===
using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public PlayerController player;
    public EnemyController food;
    public UIManager uiManager;
    public GameConfig config;
    public Vector2Int gridSize;
    private int score;
    private bool isGameOver;

    private void Start()
    {
        score = 0;
        isGameOver = false;
        uiManager.UpdateScore(score);
        food.SpawnFood();
    }

    public void OnFoodEaten()
    {
        score += config.scorePerFood;
        uiManager.UpdateScore(score);
        player.Grow();
        food.SpawnFood();
    }

    public void OnCollision()
    {
        if (!isGameOver)
        {
            isGameOver = true;
            uiManager.ShowGameOver(score);
        }
    }

    public void RestartGame()
    {
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }

    public bool IsPositionValid(Vector2Int position)
    {
        return position.x >= 0 && position.x < gridSize.x && position.y >= 0 && position.y < gridSize.y;
    }
}