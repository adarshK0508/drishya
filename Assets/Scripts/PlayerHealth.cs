using UnityEngine;

public sealed class PlayerHealth : MonoBehaviour
{
    [Min(1f)] public float maxHealth = 100f;
    public float CurrentHealth { get; private set; }
    public bool IsDead => CurrentHealth <= 0f;

    private void Awake() => CurrentHealth = maxHealth;

    public void TakeDamage(float amount)
    {
        if (IsDead || amount <= 0f) return;
        CurrentHealth = Mathf.Max(0f, CurrentHealth - amount);
        if (IsDead) Debug.Log("You were defeated. Press R to restart the arena.");
    }

    public void ResetHealth() => CurrentHealth = maxHealth;
}
