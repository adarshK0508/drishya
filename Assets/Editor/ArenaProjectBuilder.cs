using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using System.IO;

[InitializeOnLoad]
public static class ArenaProjectBuilder
{
    private const string ScenePath = "Assets/Scenes/Arena.unity";
    private static bool building;

    static ArenaProjectBuilder()
    {
        EditorApplication.delayCall += EnsureStarterScene;
    }

    [MenuItem("Tools/Arena Shooter/Build or Reset Demo Arena")]
    public static void BuildFromMenu()
    {
        if (!EditorUtility.DisplayDialog("Build Demo Arena", "Rebuild the generated Arena scene? This replaces the current contents of Assets/Scenes/Arena.unity.", "Build Arena", "Cancel")) return;
        BuildScene();
    }

    [MenuItem("Tools/Arena Shooter/Add LAN POV Link to Existing Scene")]
    public static void AddLanPovLinkToExistingScene()
    {
        GameObject player = GameObject.Find("Player");
        Transform playerCamera = player ? player.transform.Find("Player Camera") : null;
        if (!playerCamera)
        {
            EditorUtility.DisplayDialog("LAN POV Link", "Could not find Player/Player Camera in the open scene.", "OK");
            return;
        }

        if (!playerCamera.GetComponent<LanPovLink>())
            Undo.AddComponent<LanPovLink>(playerCamera.gameObject);

        EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), ScenePath);
        Debug.Log("LAN POV link added to Player/Player Camera in Assets/Scenes/Arena.unity.");
    }

    private static void EnsureStarterScene()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode || File.Exists(ScenePath) || building) return;
        BuildScene();
    }

    private static void BuildScene()
    {
        if (building) return;
        building = true;
        try
        {
            ArenaGameSettings previousSettings = Object.FindAnyObjectByType<ArenaGameSettings>();
            string savedSettings = previousSettings ? JsonUtility.ToJson(previousSettings) : null;
            Directory.CreateDirectory("Assets/Scenes");
            Directory.CreateDirectory("Assets/Materials");
            AssetDatabase.Refresh();

            Material groundMat = MakeMaterial("Arena Ground", new Color(0.12f, 0.19f, 0.24f));
            Material edgeMat = MakeMaterial("Arena Edge", new Color(0.055f, 0.09f, 0.13f));
            Material targetMat = MakeMaterial("Target Red", new Color(0.9f, 0.19f, 0.14f));
            Material accentMat = MakeMaterial("Target Accent", new Color(1f, 0.63f, 0.12f));

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            GameObject settingsObject = new GameObject("Arena Settings");
            ArenaGameSettings settings = settingsObject.AddComponent<ArenaGameSettings>();
            if (!string.IsNullOrEmpty(savedSettings)) JsonUtility.FromJsonOverwrite(savedSettings, settings);

            GameObject floor = new GameObject("Circular Arena");
            MeshFilter filter = floor.AddComponent<MeshFilter>();
            MeshRenderer renderer = floor.AddComponent<MeshRenderer>();
            MeshCollider collider = floor.AddComponent<MeshCollider>();
            filter.sharedMesh = MakeDisc(settings.arenaRadius, settings.arenaThickness, 64);
            collider.sharedMesh = filter.sharedMesh;
            renderer.sharedMaterial = groundMat;
            floor.transform.position = Vector3.zero;
            GameObject rim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            rim.name = "Arena Foundation";
            rim.transform.position = new Vector3(0f, settings.arenaThickness * 0.5f, 0f);
            rim.transform.localScale = new Vector3(settings.arenaRadius * 2f, settings.arenaThickness * 0.5f, settings.arenaRadius * 2f);
            rim.GetComponent<Renderer>().sharedMaterial = edgeMat;
            rim.GetComponent<Collider>().enabled = false;

            GameObject lightObject = new GameObject("Directional Light");
            Light sun = lightObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.15f;
            lightObject.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.42f, 0.56f, 0.68f);
            RenderSettings.ambientEquatorColor = new Color(0.27f, 0.31f, 0.34f);
            RenderSettings.ambientGroundColor = new Color(0.1f, 0.12f, 0.14f);
            Camera.main?.gameObject.SetActive(false);
            scene = SceneManager.GetActiveScene();

            GameObject player = new GameObject("Player");
            player.transform.position = new Vector3(0f, settings.arenaThickness, -settings.arenaRadius * 0.5f);
            CharacterController controller = player.AddComponent<CharacterController>();
            controller.height = settings.playerHeight;
            controller.radius = settings.playerRadius;
            controller.center = new Vector3(0f, settings.playerHeight * 0.5f, 0f);
            PlayerHealth health = player.AddComponent<PlayerHealth>();
            health.maxHealth = settings.playerHealth;
            PlayerShooterController mover = player.AddComponent<PlayerShooterController>();
            mover.settings = settings;

            GameObject view = new GameObject("Player Camera");
            view.transform.SetParent(player.transform, false);
            view.transform.localPosition = new Vector3(0f, settings.playerHeight * 0.9f, 0f);
            Camera camera = view.AddComponent<Camera>();
            camera.fieldOfView = settings.playerFieldOfView;
            camera.nearClipPlane = 0.03f;
            camera.backgroundColor = new Color(0.47f, 0.68f, 0.84f);
            camera.clearFlags = CameraClearFlags.Skybox;
            view.AddComponent<AudioListener>();
            mover.viewCamera = view.transform;

            view.AddComponent<LanPovLink>();

            PlayerWeapon weapon = view.AddComponent<PlayerWeapon>();
            weapon.aimCamera = camera;
            weapon.settings = settings;

            CreateHUD(camera, health, settings);
            SpawnTargets(settings, player.transform, health, targetMat, accentMat);

            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            Selection.activeGameObject = settingsObject;
            Debug.Log("Arena Shooter starter scene created at Assets/Scenes/Arena.unity.");
        }
        finally { building = false; }
    }

    private static void SpawnTargets(ArenaGameSettings settings, Transform player, PlayerHealth health, Material bodyMat, Material accentMat)
    {
        for (int i = 0; i < settings.targetCount; i++)
        {
            float angle = Mathf.PI * 2f * i / settings.targetCount;
            float radius = settings.arenaRadius * 0.58f;
            GameObject target = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            target.name = $"Target Bot {i + 1:00}";
            target.transform.position = new Vector3(Mathf.Cos(angle) * radius, settings.arenaThickness + 1f, Mathf.Sin(angle) * radius);
            target.transform.localScale = new Vector3(1.1f, 1f, 1.1f);
            Renderer targetRenderer = target.GetComponent<Renderer>();
            targetRenderer.sharedMaterial = bodyMat;
            TargetBot bot = target.AddComponent<TargetBot>();
            bot.maxHealth = settings.targetHealth;
            bot.attackDamage = settings.targetAttackDamage;
            bot.attackInterval = settings.targetAttackInterval;
            bot.moveSpeed = settings.targetMoveSpeed;
            bot.arenaRadius = settings.arenaRadius;
            bot.player = player;
            bot.playerHealth = health;
            bot.bodyRenderer = targetRenderer;

            GameObject marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "Target Core";
            marker.transform.SetParent(target.transform, false);
            marker.transform.localPosition = new Vector3(0f, 0.12f, 0f);
            marker.transform.localScale = Vector3.one * 0.32f;
            marker.GetComponent<Renderer>().sharedMaterial = accentMat;
            marker.GetComponent<Collider>().enabled = false;
        }
    }

    private static void CreateHUD(Camera camera, PlayerHealth health, ArenaGameSettings settings)
    {
        GameObject canvasObject = new GameObject("HUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        Canvas canvas = canvasObject.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920f, 1080f);
        ArenaHUD hud = canvasObject.AddComponent<ArenaHUD>();
        hud.health = health;

        GameObject vignetteObject = new GameObject("Vision Fade", typeof(RectTransform), typeof(UnityEngine.UI.Image));
        vignetteObject.transform.SetParent(canvasObject.transform, false);
        RectTransform vignetteRect = vignetteObject.GetComponent<RectTransform>();
        vignetteRect.anchorMin = Vector2.zero;
        vignetteRect.anchorMax = Vector2.one;
        vignetteRect.offsetMin = Vector2.zero;
        vignetteRect.offsetMax = Vector2.zero;
        UnityEngine.UI.Image vignetteImage = vignetteObject.GetComponent<UnityEngine.UI.Image>();
        vignetteImage.color = Color.black;
        vignetteImage.raycastTarget = false;
        VisionVignette vignette = vignetteObject.AddComponent<VisionVignette>();
        vignette.settings = settings;
        vignette.overlay = vignetteImage;

        GameObject cross = new GameObject("Crosshair", typeof(RectTransform));
        cross.transform.SetParent(canvasObject.transform, false);
        RectTransform crossRect = cross.GetComponent<RectTransform>();
        crossRect.anchorMin = crossRect.anchorMax = new Vector2(0.5f, 0.5f);
        crossRect.sizeDelta = Vector2.zero;
        MakeImage(cross.transform, "Horizontal", new Vector2(0f, 0f), new Vector2(24f, 2f), Color.white);
        MakeImage(cross.transform, "Vertical", new Vector2(0f, 0f), new Vector2(2f, 24f), Color.white);
        MakeImage(cross.transform, "Center", Vector2.zero, new Vector2(4f, 4f), new Color(1f, 0.72f, 0.22f));

        GameObject panel = new GameObject("Health Panel", typeof(RectTransform));
        panel.transform.SetParent(canvasObject.transform, false);
        RectTransform panelRect = panel.GetComponent<RectTransform>();
        panelRect.anchorMin = panelRect.anchorMax = new Vector2(0f, 0f);
        panelRect.pivot = new Vector2(0f, 0f);
        panelRect.anchoredPosition = new Vector2(28f, 28f);
        panelRect.sizeDelta = new Vector2(330f, 70f);
        Text label = panel.AddComponent<Text>();
        label.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        label.fontSize = 22;
        label.fontStyle = FontStyle.Bold;
        label.color = Color.white;
        label.alignment = TextAnchor.UpperLeft;
        hud.healthLabel = label;
        GameObject barBack = new GameObject("Health Bar Background", typeof(RectTransform), typeof(Image));
        barBack.transform.SetParent(panel.transform, false);
        RectTransform backRect = barBack.GetComponent<RectTransform>();
        backRect.anchorMin = new Vector2(0f, 0f);
        backRect.anchorMax = new Vector2(1f, 0f);
        backRect.pivot = new Vector2(0f, 0f);
        backRect.anchoredPosition = Vector2.zero;
        backRect.sizeDelta = new Vector2(0f, 18f);
        barBack.GetComponent<Image>().color = new Color(0.02f, 0.03f, 0.05f, 0.85f);
        GameObject bar = new GameObject("Health Bar Fill", typeof(RectTransform), typeof(Image));
        bar.transform.SetParent(barBack.transform, false);
        RectTransform barRect = bar.GetComponent<RectTransform>();
        barRect.anchorMin = Vector2.zero;
        barRect.anchorMax = Vector2.one;
        barRect.offsetMin = Vector2.zero;
        barRect.offsetMax = Vector2.zero;
        Image fill = bar.GetComponent<Image>();
        fill.color = new Color(0.22f, 0.88f, 0.52f);
        fill.type = Image.Type.Filled;
        fill.fillMethod = Image.FillMethod.Horizontal;
        hud.healthFill = fill;

        GameObject hint = new GameObject("Restart Hint", typeof(RectTransform));
        hint.transform.SetParent(canvasObject.transform, false);
        RectTransform hintRect = hint.GetComponent<RectTransform>();
        hintRect.anchorMin = hintRect.anchorMax = new Vector2(0.5f, 0.34f);
        hintRect.sizeDelta = new Vector2(600f, 60f);
        Text hintText = hint.AddComponent<Text>();
        hintText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        hintText.fontSize = 26;
        hintText.fontStyle = FontStyle.Bold;
        hintText.alignment = TextAnchor.MiddleCenter;
        hintText.color = Color.white;
        hintText.text = "DEFEATED  —  PRESS R TO RESTART";
        hud.restartHint = hint;
        hint.SetActive(false);

        GameObject controls = new GameObject("Controls", typeof(RectTransform));
        controls.transform.SetParent(canvasObject.transform, false);
        RectTransform controlsRect = controls.GetComponent<RectTransform>();
        controlsRect.anchorMin = controlsRect.anchorMax = new Vector2(1f, 0f);
        controlsRect.pivot = new Vector2(1f, 0f);
        controlsRect.anchoredPosition = new Vector2(-26f, 25f);
        controlsRect.sizeDelta = new Vector2(380f, 34f);
        Text controlsText = controls.AddComponent<Text>();
        controlsText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        controlsText.fontSize = 16;
        controlsText.alignment = TextAnchor.LowerRight;
        controlsText.color = new Color(1f, 1f, 1f, 0.8f);
        controlsText.text = "WASD MOVE   •   MOUSE AIM   •   LMB FIRE   •   ESC UNLOCK";
    }

    private static void MakeImage(Transform parent, string name, Vector2 position, Vector2 size, Color color)
    {
        GameObject go = new GameObject(name, typeof(RectTransform), typeof(Image));
        go.transform.SetParent(parent, false);
        RectTransform rect = go.GetComponent<RectTransform>();
        rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
        rect.anchoredPosition = position;
        rect.sizeDelta = size;
        go.GetComponent<Image>().color = color;
    }

    private static Material MakeMaterial(string name, Color color)
    {
        string path = $"Assets/Materials/{name.Replace(' ', '_')}.mat";
        Material existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing) { existing.color = color; EditorUtility.SetDirty(existing); return existing; }
        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        if (!shader) shader = Shader.Find("Standard");
        if (!shader) shader = Shader.Find("Sprites/Default");
        Material material = new Material(shader) { name = name, color = color };
        AssetDatabase.CreateAsset(material, path);
        return material;
    }

    private static Mesh MakeDisc(float radius, float thickness, int segments)
    {
        Mesh mesh = new Mesh { name = "Circular Arena Disc" };
        Vector3[] vertices = new Vector3[segments + 1];
        int[] triangles = new int[segments * 3];
        vertices[0] = new Vector3(0f, thickness, 0f);
        for (int i = 0; i < segments; i++)
        {
            float angle = Mathf.PI * 2f * i / segments;
            vertices[i + 1] = new Vector3(Mathf.Cos(angle) * radius, thickness, Mathf.Sin(angle) * radius);
            triangles[i * 3] = 0;
            triangles[i * 3 + 1] = (i + 1) % segments + 1;
            triangles[i * 3 + 2] = i + 1;
        }
        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        const string meshPath = "Assets/Materials/Circular_Arena_Disc.asset";
        AssetDatabase.DeleteAsset(meshPath);
        AssetDatabase.CreateAsset(mesh, meshPath);
        return mesh;
    }
}
