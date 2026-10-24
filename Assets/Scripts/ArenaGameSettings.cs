using UnityEngine;

/// <summary>One place to tune the arena and the default player setup in the Inspector.</summary>
public sealed class ArenaGameSettings : MonoBehaviour
{
    [Header("Arena")]
    [Min(5f)] public float arenaRadius = 24f;
    [Min(0.1f)] public float arenaThickness = 1f;
    public Color groundColor = new Color(0.12f, 0.19f, 0.24f);
    public Color arenaEdgeColor = new Color(0.08f, 0.12f, 0.16f);

    [Header("Player")]
    [Min(1f)] public float playerHealth = 100f;
    [Min(0.2f)] public float playerHeight = 1.8f;
    [Min(0.1f)] public float playerRadius = 0.38f;
    [Min(0.1f)] public float moveSpeed = 7f;
    [Min(0f)] public float mouseSensitivity = 2f;
    [Tooltip("Camera vertical field of view in degrees.")]
    [Range(35f, 110f)] public float playerFieldOfView = 70f;

    [Header("Vision")]
    [Tooltip("Clear radius at the center of the screen. The radial mask fades to black beyond this radius.")]
    [Range(0.1f, 1.25f)] public float visionClearRadius = 0.62f;
    [Tooltip("Width of the soft transition from clear vision to darkness.")]
    [Range(0.05f, 1.25f)] public float visionFadeWidth = 0.48f;
    [Range(0f, 1f)] public float visionDarkness = 1f;

    [Header("Weapon")]
    [Min(1f)] public float damagePerShot = 34f;
    [Min(0.02f)] public float shotsPerSecond = 5f;
    [Min(10f)] public float weaponRange = 100f;

    [Header("Targets")]
    [Range(0, 16)] public int targetCount = 6;
    [Min(1f)] public float targetHealth = 100f;
    [Min(0f)] public float targetAttackDamage = 8f;
    [Min(0.2f)] public float targetAttackInterval = 1.2f;
    [Min(1f)] public float targetMoveSpeed = 2f;
}
