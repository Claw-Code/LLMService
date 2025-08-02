// === Scripts/EnemyController.cs ===
using UnityEngine;

public class EnemyController : MonoBehaviour
{
    public GameManager gameManager;
    public Animator animator;
    public float spawnInterval = 1f;

    private void Awake()
    {
        animator.SetBool("Pulsing", true);
    }

    public void SpawnFood()
    {
        Vector2Int newPosition;
        do
        {
            newPosition = new Vector2Int(
                Random.Range(0, gameManager.gridSize.x),
                Random.Range(0, gameManager.gridSize.y)
            );
        } while (!gameManager.IsPositionValid(newPosition));
        transform.position = new Vector3(newPosition.x, newPosition.y, 0);
    }
}