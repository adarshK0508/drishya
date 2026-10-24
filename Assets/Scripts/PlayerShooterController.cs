using UnityEngine;

[RequireComponent(typeof(CharacterController), typeof(PlayerHealth))]
public sealed class PlayerShooterController : MonoBehaviour
{
    public Transform viewCamera;
    public ArenaGameSettings settings;
    public float gravity = -22f;
    private CharacterController body;
    private PlayerHealth health;
    private float pitch;
    private float verticalVelocity;

    private void Awake()
    {
        body = GetComponent<CharacterController>();
        health = GetComponent<PlayerHealth>();
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    private void Update()
    {
        if (settings && viewCamera)
        {
            Camera playerCamera = viewCamera.GetComponent<Camera>();
            if (playerCamera) playerCamera.fieldOfView = settings.playerFieldOfView;
        }

        if (Input.GetKeyDown(KeyCode.Escape))
        {
            bool unlock = Cursor.lockState == CursorLockMode.Locked;
            Cursor.lockState = unlock ? CursorLockMode.None : CursorLockMode.Locked;
            Cursor.visible = unlock;
        }
        if (health.IsDead)
        {
            if (Input.GetKeyDown(KeyCode.R)) UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
            return;
        }
        if (Cursor.lockState != CursorLockMode.Locked) return;

        float sensitivity = settings ? settings.mouseSensitivity : 2f;
        transform.Rotate(Vector3.up, Input.GetAxis("Mouse X") * sensitivity, Space.World);
        pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * sensitivity, -85f, 85f);
        if (viewCamera) viewCamera.localRotation = Quaternion.Euler(pitch, 0f, 0f);

        Vector3 input = transform.right * Input.GetAxisRaw("Horizontal") + transform.forward * Input.GetAxisRaw("Vertical");
        input = Vector3.ClampMagnitude(input, 1f);
        float speed = settings ? settings.moveSpeed : 7f;
        if (body.isGrounded && verticalVelocity < 0f) verticalVelocity = -2f;
        verticalVelocity += gravity * Time.deltaTime;
        body.Move((input * speed + Vector3.up * verticalVelocity) * Time.deltaTime);
        if (settings)
        {
            Vector2 flatPosition = new Vector2(transform.position.x, transform.position.z);
            float maxDistance = Mathf.Max(1f, settings.arenaRadius - body.radius);
            if (flatPosition.sqrMagnitude > maxDistance * maxDistance)
            {
                flatPosition = flatPosition.normalized * maxDistance;
                transform.position = new Vector3(flatPosition.x, transform.position.y, flatPosition.y);
            }
        }
    }
}
