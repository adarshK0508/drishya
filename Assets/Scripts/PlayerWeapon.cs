using System.Collections;
using UnityEngine;

public sealed class PlayerWeapon : MonoBehaviour
{
    public Camera aimCamera;
    public ArenaGameSettings settings;
    public float damage = 34f;
    public float shotsPerSecond = 5f;
    public float range = 100f;
    public LayerMask hitMask = ~0;
    public Color tracerColor = new Color(1f, 0.72f, 0.22f);
    private float nextShotTime;

    private void Update()
    {
        if (Input.GetMouseButton(0) && Time.time >= nextShotTime && Cursor.lockState == CursorLockMode.Locked)
        {
            nextShotTime = Time.time + 1f / Mathf.Max(0.02f, shotsPerSecond);
            Fire();
        }
    }

    private void Fire()
    {
        if (!aimCamera) return;
        float shotDamage = settings ? settings.damagePerShot : damage;
        float shotRange = settings ? settings.weaponRange : range;
        Ray ray = new Ray(aimCamera.transform.position, aimCamera.transform.forward);
        Vector3 end = ray.origin + ray.direction * shotRange;
        if (Physics.Raycast(ray, out RaycastHit hit, shotRange, hitMask, QueryTriggerInteraction.Ignore))
        {
            end = hit.point;
            TargetBot target = hit.collider.GetComponentInParent<TargetBot>();
            if (target) target.TakeDamage(shotDamage);
        }
        StartCoroutine(ShowTracer(ray.origin + ray.direction * 0.35f, end));
    }

    private IEnumerator ShowTracer(Vector3 start, Vector3 end)
    {
        GameObject lineObject = new GameObject("Shot tracer");
        LineRenderer line = lineObject.AddComponent<LineRenderer>();
        line.positionCount = 2;
        line.SetPosition(0, start);
        line.SetPosition(1, end);
        line.startWidth = 0.035f;
        line.endWidth = 0.005f;
        line.useWorldSpace = true;
        line.material = new Material(Shader.Find("Sprites/Default"));
        line.startColor = tracerColor;
        line.endColor = new Color(tracerColor.r, tracerColor.g, tracerColor.b, 0f);
        Destroy(lineObject, 0.07f);
        yield return null;
    }
}
