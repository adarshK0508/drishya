using UnityEngine;

/// <summary>Soft radial darkness around the player's central field of view.</summary>
public sealed class VisionVignette : MonoBehaviour
{
    public ArenaGameSettings settings;
    public UnityEngine.UI.Image overlay;

    private Texture2D texture;
    private Sprite sprite;
    private float lastRadius = -1f;
    private float lastFadeWidth = -1f;
    private float lastDarkness = -1f;

    private void Start() => RefreshMask();

    private void Update()
    {
        if (!settings || !overlay) return;
        if (!Mathf.Approximately(lastRadius, settings.visionClearRadius) ||
            !Mathf.Approximately(lastFadeWidth, settings.visionFadeWidth) ||
            !Mathf.Approximately(lastDarkness, settings.visionDarkness))
            RefreshMask();
    }

    private void RefreshMask()
    {
        if (!settings || !overlay) return;
        const int resolution = 256;
        if (!texture)
        {
            texture = new Texture2D(resolution, resolution, TextureFormat.RGBA32, false, true)
            {
                name = "Runtime Vision Fade",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };
            sprite = Sprite.Create(texture, new Rect(0f, 0f, resolution, resolution), new Vector2(0.5f, 0.5f), 100f);
            sprite.name = "Runtime Vision Fade Sprite";
            overlay.sprite = sprite;
            overlay.type = UnityEngine.UI.Image.Type.Simple;
            overlay.color = Color.black;
            overlay.raycastTarget = false;
        }

        float radius = Mathf.Max(0.01f, settings.visionClearRadius);
        float fadeWidth = Mathf.Max(0.01f, settings.visionFadeWidth);
        float darkness = Mathf.Clamp01(settings.visionDarkness);
        Color32[] pixels = new Color32[resolution * resolution];
        for (int y = 0; y < resolution; y++)
        for (int x = 0; x < resolution; x++)
        {
            float u = (x + 0.5f) / resolution;
            float v = (y + 0.5f) / resolution;
            float radialDistance = Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f;
            float fade = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(radius, radius + fadeWidth, radialDistance));
            byte alpha = (byte)Mathf.RoundToInt(fade * darkness * 255f);
            pixels[y * resolution + x] = new Color32(255, 255, 255, alpha);
        }
        texture.SetPixels32(pixels);
        texture.Apply(false, false);
        lastRadius = settings.visionClearRadius;
        lastFadeWidth = settings.visionFadeWidth;
        lastDarkness = settings.visionDarkness;
    }

    private void OnDestroy()
    {
        if (sprite) Destroy(sprite);
        if (texture) Destroy(texture);
    }
}
