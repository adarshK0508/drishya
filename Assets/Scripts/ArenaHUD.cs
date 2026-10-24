using UnityEngine;
using UnityEngine.UI;

public sealed class ArenaHUD : MonoBehaviour
{
    public PlayerHealth health;
    public Image healthFill;
    public Text healthLabel;
    public GameObject restartHint;

    private void Update()
    {
        if (!health) return;
        float normalized = health.maxHealth <= 0f ? 0f : health.CurrentHealth / health.maxHealth;
        if (healthFill) healthFill.fillAmount = normalized;
        if (healthLabel) healthLabel.text = $"HEALTH  {Mathf.CeilToInt(health.CurrentHealth)} / {Mathf.CeilToInt(health.maxHealth)}";
        if (restartHint) restartHint.SetActive(health.IsDead);
    }
}
