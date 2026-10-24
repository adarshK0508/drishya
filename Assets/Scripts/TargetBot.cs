using UnityEngine;

public sealed class TargetBot : MonoBehaviour
{
    public float maxHealth = 100f;
    public float attackDamage = 8f;
    public float attackInterval = 1.2f;
    public float moveSpeed = 2f;
    public float attackRange = 12f;
    public float arenaRadius = 24f;
    public Transform player;
    public PlayerHealth playerHealth;
    public Renderer bodyRenderer;
    private float health;
    private float attackTimer;

    private void Start() => health = maxHealth;

    private void Update()
    {
        if (!player || !playerHealth || playerHealth.IsDead) return;
        Vector3 delta = player.position - transform.position;
        delta.y = 0f;
        float distance = delta.magnitude;
        if (distance > 2.2f && distance > attackRange * 0.65f)
        {
            Vector3 step = delta.normalized * (moveSpeed * Time.deltaTime);
            Vector3 next = transform.position + step;
            if (new Vector2(next.x, next.z).magnitude < arenaRadius - 1.5f) transform.position = next;
        }
        if (distance <= attackRange)
        {
            if (delta.sqrMagnitude > 0.001f) transform.rotation = Quaternion.LookRotation(delta);
            attackTimer -= Time.deltaTime;
            if (attackTimer <= 0f)
            {
                attackTimer = attackInterval;
                playerHealth.TakeDamage(attackDamage);
            }
        }
    }

    public void TakeDamage(float amount)
    {
        health -= amount;
        if (health <= 0f) Destroy(gameObject);
        else if (bodyRenderer) bodyRenderer.material.color = Color.Lerp(Color.white, new Color(1f, 0.18f, 0.12f), 1f - health / maxHealth);
    }
}
