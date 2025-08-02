// === Scripts/PlayerController.cs ===
using UnityEngine;
using UnityEngine.InputSystem;
using System.Collections.Generic;

public class PlayerController : MonoBehaviour
{
    public GameManager gameManager;
    public GameConfig config;
    public Animator animator;
    private List<Transform> segments = new List<Transform>();
    private Vector2Int direction = Vector2Int.right;
    private Vector2Int nextDirection;
    private Vector2Int gridPosition;
    private float moveTimer;
    private int directionId;

    private void Awake()
    {
        segments.Add(transform);
        gridPosition = Vector2Int.RoundToInt(transform.position);
        nextDirection = direction;
    }

    private void FixedUpdate()
    {
        moveTimer += Time.fixedDeltaTime;
        if (moveTimer >= config.snakeSpeed)
        {
            direction = nextDirection;
            directionId = direction == Vector2Int.up ? 0 : direction == Vector2Int.right ? 1 : direction == Vector2Int.down ? 2 : 3;
            animator.SetInteger("Direction", directionId);
            Vector2Int newPosition = gridPosition + direction;
            if (!gameManager.IsPositionValid(newPosition) || IsCollidingWithSelf(newPosition))
            {
                gameManager.OnCollision();
                return;
            }
            gridPosition = newPosition;
            UpdateSegments();
            transform.position = new Vector3(gridPosition.x, gridPosition.y, 0);
            moveTimer = 0f;
        }
    }

    private bool IsCollidingWithSelf(Vector2Int position)
    {
        foreach (var segment in segments)
        {
            if (Vector2Int.RoundToInt(segment.position) == position)
                return true;
        }
        return false;
    }

    private void UpdateSegments()
    {
        for (int i = segments.Count - 1; i > 0; i--)
        {
            segments[i].position = segments[i - 1].position;
        }
    }

    public void Grow()
    {
        animator.SetBool("IsEating", true);
        GameObject segment = Instantiate(config.segmentPrefab, transform.position, Quaternion.identity);
        segments.Add(segment.transform);
        Invoke(nameof(ResetEating), 0.1f);
    }

    private void ResetEating()
    {
        animator.SetBool("IsEating", false);
    }

    private void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Food"))
        {
            gameManager.OnFoodEaten();
        }
    }

    public void OnMove(InputAction.CallbackContext context)
    {
        if (context.performed)
        {
            Vector2 input = context.ReadValue<Vector2>();
            Vector2Int newDirection = Vector2Int.zero;
            if (Mathf.Abs(input.x) > Mathf.Abs(input.y))
            {
                newDirection = input.x > 0 ? Vector2Int.right : Vector2Int.left;
            }
            else if (input.y != 0)
            {
                newDirection = input.y > 0 ? Vector2Int.up : Vector2Int.down;
            }
            if (newDirection != Vector2Int.zero && newDirection != -direction)
            {
                nextDirection = newDirection;
            }
        }
    }
}