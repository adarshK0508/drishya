using System;
using System.Collections;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// Small two-PC LAN video link for the swapped-POV prototype.
/// One player hosts; the other enters the host's private IPv4 address and joins.
/// Frames are JPEG encoded and sent over a single full-duplex TCP connection.
/// </summary>
public sealed class LanPovLink : MonoBehaviour
{
    [Header("Stream tuning")]
    [Min(320)] public int streamWidth = 640;
    [Min(180)] public int streamHeight = 360;
    [Range(5, 60)] public int streamFramesPerSecond = 30;
    [Range(20, 90)] public int jpegQuality = 55;
    public int port = 27940;

    private Camera sourceCamera;
    private Canvas canvas;
    private RawImage remoteView;
    private Texture2D receivedTexture;
    private Texture2D captureTexture;
    private RenderTexture captureTarget;
    private Camera captureCamera;
    private volatile TcpListener listener;
    private volatile TcpClient client;
    private NetworkStream networkStream;
    private Thread receiveThread;
    private Thread sendThread;
    private readonly object connectionLock = new object();
    private readonly object outgoingLock = new object();
    private byte[] outgoingFrame;
    private byte[] incomingFrame;
    private volatile bool connected;
    private volatile bool shuttingDown;
    private bool captureActive;
    private bool hasRemoteFrame;
    private volatile bool listenStarted;
    private volatile bool joining;
    private PlayerShooterController playerController;
    private PlayerWeapon playerWeapon;
    private TargetBot[] targetBots;
    private volatile string status = "Host on one PC, then join from the other PC.";
    private InputField addressField;
    private GameObject connectionPanel;
    private Text statusText;
    private GameObject statsPanel;
    private Text statsText;
    private int sentFrames;
    private int receivedFrames;
    private int gameFrames;
    private float statsSampleStarted;

    private const byte VideoPacket = 1;
    private const int MaximumFrameBytes = 1_500_000;

    private void Start()
    {
        sourceCamera = GetComponent<Camera>();
        canvas = FindAnyObjectByType<Canvas>();
        if (!sourceCamera || !canvas)
        {
            Debug.LogError("LanPovLink requires a Camera and a screen-space Canvas.", this);
            enabled = false;
            return;
        }

        BuildConnectionUI();
        statsSampleStarted = Time.realtimeSinceStartup;
        Application.runInBackground = true;
        playerController = FindAnyObjectByType<PlayerShooterController>();
        playerWeapon = FindAnyObjectByType<PlayerWeapon>();
        targetBots = FindObjectsByType<TargetBot>();
        SetGameplayEnabled(false);
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        receivedTexture = new Texture2D(streamWidth, streamHeight, TextureFormat.RGB24, false)
        {
            name = "Partner POV Frame",
            wrapMode = TextureWrapMode.Clamp,
            filterMode = FilterMode.Bilinear
        };
        StartCoroutine(CaptureFrames());
    }

    private void Update()
    {
        gameFrames++;
        if (!captureActive && connected)
        {
            BeginCapture();
            SetGameplayEnabled(true);
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }
        if (captureActive && !connected)
        {
            EndCapture();
            SetGameplayEnabled(false);
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        byte[] frame = Interlocked.Exchange(ref incomingFrame, null);
        if (frame != null && remoteView && connected)
        {
            if (receivedTexture.width != streamWidth || receivedTexture.height != streamHeight)
                receivedTexture.Reinitialize(streamWidth, streamHeight, TextureFormat.RGB24, false);
            if (ImageConversion.LoadImage(receivedTexture, frame, false))
            {
                remoteView.texture = receivedTexture;
                remoteView.gameObject.SetActive(true);
                hasRemoteFrame = true;
            }
        }

        if (statusText) statusText.text = connected ? "Connected. Waiting for the partner's first video frame…" : status;
        if (connectionPanel) connectionPanel.SetActive(!connected || !hasRemoteFrame);
        if (statsPanel) statsPanel.SetActive(connected);
        float elapsed = Time.realtimeSinceStartup - statsSampleStarted;
        if (elapsed >= 1f)
        {
            int tx = Interlocked.Exchange(ref sentFrames, 0);
            int rx = Interlocked.Exchange(ref receivedFrames, 0);
            if (statsText) statsText.text = $"Game {gameFrames / elapsed:0} fps  |  Video out {tx / elapsed:0}  in {rx / elapsed:0} fps";
            gameFrames = 0;
            statsSampleStarted = Time.realtimeSinceStartup;
        }
    }

    private void BuildConnectionUI()
    {
        GameObject viewObject = new GameObject("Partner POV", typeof(RectTransform), typeof(RawImage));
        viewObject.transform.SetParent(canvas.transform, false);
        viewObject.transform.SetAsFirstSibling();
        RectTransform viewRect = viewObject.GetComponent<RectTransform>();
        viewRect.anchorMin = Vector2.zero;
        viewRect.anchorMax = Vector2.one;
        viewRect.offsetMin = Vector2.zero;
        viewRect.offsetMax = Vector2.zero;
        remoteView = viewObject.GetComponent<RawImage>();
        remoteView.color = Color.white;
        remoteView.raycastTarget = false;
        viewObject.SetActive(false);

        connectionPanel = new GameObject("LAN Connection", typeof(RectTransform), typeof(Image));
        connectionPanel.transform.SetParent(canvas.transform, false);
        RectTransform panelRect = connectionPanel.GetComponent<RectTransform>();
        panelRect.anchorMin = panelRect.anchorMax = new Vector2(0.5f, 1f);
        panelRect.pivot = new Vector2(0.5f, 1f);
        panelRect.anchoredPosition = new Vector2(0f, -24f);
        panelRect.sizeDelta = new Vector2(660f, 220f);
        connectionPanel.GetComponent<Image>().color = new Color(0.025f, 0.04f, 0.065f, 0.96f);

        Text title = CreateText(connectionPanel.transform, "Title", "SWAPPED POV  /  LOCAL WI-FI", 20, FontStyle.Bold);
        Place(title.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -16f), new Vector2(620f, 32f));
        title.alignment = TextAnchor.MiddleCenter;

        statusText = CreateText(connectionPanel.transform, "Status", status, 14, FontStyle.Normal);
        Place(statusText.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -51f), new Vector2(620f, 50f));
        statusText.alignment = TextAnchor.MiddleCenter;

        addressField = CreateInputField(connectionPanel.transform);
        Place(addressField.GetComponent<RectTransform>(), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -112f), new Vector2(300f, 38f));
        addressField.text = "192.168.1.100";

        Button hostButton = CreateButton(connectionPanel.transform, "Host", "HOST THIS PC", new Vector2(-145f, -165f));
        hostButton.onClick.AddListener(StartHosting);
        Button joinButton = CreateButton(connectionPanel.transform, "Join", "JOIN HOST IP", new Vector2(145f, -165f));
        joinButton.onClick.AddListener(JoinHost);

        statsPanel = new GameObject("Stream FPS", typeof(RectTransform), typeof(Image));
        statsPanel.transform.SetParent(canvas.transform, false);
        Place(statsPanel.GetComponent<RectTransform>(), Vector2.one, Vector2.one, new Vector2(-16f, -16f), new Vector2(455f, 34f));
        statsPanel.GetComponent<Image>().color = new Color(0.025f, 0.04f, 0.065f, 0.82f);
        statsPanel.GetComponent<Image>().raycastTarget = false;
        statsText = CreateText(statsPanel.transform, "FPS Readout", "Measuring video…", 15, FontStyle.Normal);
        Place(statsText.rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
        statsText.alignment = TextAnchor.MiddleCenter;
        statsPanel.SetActive(false);

        if (!FindAnyObjectByType<EventSystem>())
        {
            GameObject eventSystem = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            DontDestroyOnLoad(eventSystem);
        }
    }

    private void StartHosting()
    {
        if (connected) return;
        if (listenStarted)
        {
            status = $"Already hosting on {GetLocalIPv4Addresses()}:{port}. Waiting for player 2.";
            return;
        }
        if (joining)
        {
            status = "A Join attempt is still running. Please wait a moment.";
            return;
        }
        try
        {
            listener = new TcpListener(IPAddress.Any, port);
            listener.Start(1);
            listenStarted = true;
            status = $"Waiting on {GetLocalIPv4Addresses()}:{port}. Enter this IP on player 2.";
        }
        catch (Exception exception)
        {
            listenStarted = false;
            listener = null;
            status = "Host failed: " + exception.Message;
            return;
        }
        TcpListener activeListener = listener;
        Task.Run(() =>
        {
            try
            {
                TcpClient accepted = activeListener.AcceptTcpClient();
                accepted.NoDelay = true;
                EstablishConnection(accepted);
            }
            catch (Exception exception)
            {
                if (!shuttingDown && listener == activeListener)
                    status = "Host stopped: " + exception.Message;
            }
            finally
            {
                if (listener == activeListener)
                {
                    try { activeListener.Stop(); } catch { }
                    listener = null;
                    listenStarted = false;
                }
            }
        });
    }

    private void JoinHost()
    {
        if (connected || joining) return;
        if (listenStarted)
        {
            status = "This PC is hosting. Join from the other PC using the IP shown here.";
            return;
        }
        string address = addressField ? addressField.text.Trim() : string.Empty;
        if (!IPAddress.TryParse(address, out IPAddress parsed) || parsed.AddressFamily != AddressFamily.InterNetwork)
        {
            status = "Enter the host PC's private IPv4 address.";
            return;
        }

        joining = true;
        status = $"Connecting to {parsed}:{port} (5 second timeout)…";
        Task.Run(() =>
        {
            TcpClient joiningClient = null;
            try
            {
                joiningClient = new TcpClient { NoDelay = true };
                IAsyncResult pending = joiningClient.BeginConnect(parsed, port, null, null);
                if (!pending.AsyncWaitHandle.WaitOne(5000)) throw new TimeoutException("Timed out. Check both PCs are on the same Wi-Fi and allow this game through Windows Firewall.");
                joiningClient.EndConnect(pending);
                EstablishConnection(joiningClient);
                joiningClient = null;
            }
            catch (Exception exception)
            {
                if (!shuttingDown) status = "Could not connect: " + exception.Message;
            }
            finally
            {
                joiningClient?.Close();
                joining = false;
            }
        });
    }

    private void EstablishConnection(TcpClient establishedClient)
    {
        lock (connectionLock)
        {
            if (shuttingDown)
            {
                establishedClient.Close();
                return;
            }
            if (connected)
            {
                establishedClient.Close();
                return;
            }
            client = establishedClient;
            networkStream = establishedClient.GetStream();
            connected = true;
        }

        NetworkStream activeStream = networkStream;
        TcpClient activeClient = establishedClient;
        receiveThread = new Thread(() => ReceiveLoop(activeStream, activeClient)) { IsBackground = true, Name = "LAN POV receiver" };
        sendThread = new Thread(() => SendLoop(activeStream, activeClient)) { IsBackground = true, Name = "LAN POV sender" };
        receiveThread.Start();
        sendThread.Start();
    }

    private IEnumerator CaptureFrames()
    {
        WaitForEndOfFrame endOfFrame = new WaitForEndOfFrame();
        double nextCaptureTime = 0;
        while (enabled)
        {
            yield return endOfFrame;
            if (connected && captureActive)
            {
                double now = Time.realtimeSinceStartupAsDouble;
                if (now < nextCaptureTime) continue;
                double interval = 1.0 / Mathf.Max(1, streamFramesPerSecond);
                nextCaptureTime += interval;
                if (nextCaptureTime <= now) nextCaptureTime = now + interval;
                captureCamera.transform.SetPositionAndRotation(sourceCamera.transform.position, sourceCamera.transform.rotation);
                captureCamera.fieldOfView = sourceCamera.fieldOfView;
                captureCamera.Render();
                RenderTexture previous = RenderTexture.active;
                RenderTexture.active = captureTarget;
                captureTexture.ReadPixels(new Rect(0, 0, streamWidth, streamHeight), 0, 0, false);
                captureTexture.Apply(false, false);
                RenderTexture.active = previous;
                byte[] encoded = ImageConversion.EncodeToJPG(captureTexture, jpegQuality);
                lock (outgoingLock) outgoingFrame = encoded;
            }
            else nextCaptureTime = 0;
        }
    }

    private void BeginCapture()
    {
        captureTarget = new RenderTexture(streamWidth, streamHeight, 16, RenderTextureFormat.ARGB32)
        {
            name = "LAN POV Capture",
            antiAliasing = 1,
            useMipMap = false,
            autoGenerateMips = false
        };
        captureTarget.Create();
        captureTexture = new Texture2D(streamWidth, streamHeight, TextureFormat.RGB24, false)
        {
            name = "LAN POV Encoder",
            wrapMode = TextureWrapMode.Clamp,
            filterMode = FilterMode.Bilinear
        };
        GameObject captureObject = new GameObject("LAN POV Capture Camera");
        captureCamera = captureObject.AddComponent<Camera>();
        captureCamera.CopyFrom(sourceCamera);
        captureCamera.enabled = false;
        captureCamera.targetTexture = captureTarget;
        captureCamera.aspect = (float)streamWidth / streamHeight;
        remoteView.texture = receivedTexture;
        remoteView.gameObject.SetActive(false);
        hasRemoteFrame = false;
        captureActive = true;
    }

    private void EndCapture()
    {
        if (!captureActive) return;
        captureActive = false;
        remoteView.texture = null;
        remoteView.gameObject.SetActive(false);
        hasRemoteFrame = false;
        Interlocked.Exchange(ref incomingFrame, null);
        if (captureCamera) Destroy(captureCamera.gameObject);
        captureCamera = null;
        if (captureTarget)
        {
            captureTarget.Release();
            Destroy(captureTarget);
            captureTarget = null;
        }
        if (captureTexture) Destroy(captureTexture);
        captureTexture = null;
    }

    private void SendLoop(NetworkStream stream, TcpClient activeClient)
    {
        try
        {
            while (connected && client == activeClient && !shuttingDown)
            {
                byte[] frame = null;
                lock (outgoingLock)
                {
                    frame = outgoingFrame;
                    outgoingFrame = null;
                }
                if (frame == null)
                {
                    Thread.Sleep(2);
                    continue;
                }

                byte[] header = new byte[5];
                header[0] = VideoPacket;
                Buffer.BlockCopy(BitConverter.GetBytes(frame.Length), 0, header, 1, 4);
                stream.Write(header, 0, header.Length);
                stream.Write(frame, 0, frame.Length);
                Interlocked.Increment(ref sentFrames);
            }
        }
        catch (Exception exception)
        {
            if (!shuttingDown && client == activeClient) status = "Video link ended: " + exception.Message;
        }
        finally { Disconnect(activeClient); }
    }

    private void ReceiveLoop(NetworkStream stream, TcpClient activeClient)
    {
        try
        {
            byte[] header = new byte[5];
            while (connected && client == activeClient && !shuttingDown)
            {
                ReadExactly(stream, header, 0, header.Length);
                if (header[0] != VideoPacket) throw new IOException("Received an unknown LAN video packet.");
                int length = BitConverter.ToInt32(header, 1);
                if (length <= 0 || length > MaximumFrameBytes) throw new IOException("Received an invalid video frame size.");
                byte[] frame = new byte[length];
                ReadExactly(stream, frame, 0, length);
                Interlocked.Exchange(ref incomingFrame, frame);
                Interlocked.Increment(ref receivedFrames);
            }
        }
        catch (Exception exception)
        {
            if (!shuttingDown && client == activeClient) status = "Video link ended: " + exception.Message;
        }
        finally { Disconnect(activeClient); }
    }

    private static void ReadExactly(NetworkStream stream, byte[] buffer, int offset, int count)
    {
        while (count > 0)
        {
            int read = stream.Read(buffer, offset, count);
            if (read == 0) throw new IOException("The other PC disconnected.");
            offset += read;
            count -= read;
        }
    }

    private void Disconnect(TcpClient expectedClient = null)
    {
        lock (connectionLock)
        {
            if (expectedClient != null && client != expectedClient) return;
            connected = false;
            try { networkStream?.Close(); } catch { }
            try { client?.Close(); } catch { }
            networkStream = null;
            client = null;
        }
    }

    private void SetGameplayEnabled(bool value)
    {
        if (playerController) playerController.enabled = value;
        if (playerWeapon) playerWeapon.enabled = value;
        if (targetBots != null)
            foreach (TargetBot bot in targetBots)
                if (bot) bot.enabled = value;
    }

    private static string GetLocalIPv4Addresses()
    {
        StringBuilder addresses = new StringBuilder();
        foreach (NetworkInterface adapter in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (adapter.OperationalStatus != OperationalStatus.Up) continue;
            foreach (UnicastIPAddressInformation item in adapter.GetIPProperties().UnicastAddresses)
            {
                IPAddress address = item.Address;
                if (address.AddressFamily != AddressFamily.InterNetwork || IPAddress.IsLoopback(address)) continue;
                if (addresses.Length > 0) addresses.Append("  ");
                addresses.Append(address);
            }
        }
        return addresses.Length > 0 ? addresses.ToString() : "find this PC's IPv4 address in Windows Network Settings";
    }

    private static void Place(RectTransform rect, Vector2 anchorMin, Vector2 anchorMax, Vector2 position, Vector2 size)
    {
        rect.anchorMin = anchorMin;
        rect.anchorMax = anchorMax;
        rect.pivot = anchorMin == anchorMax ? anchorMin : new Vector2(0.5f, 0.5f);
        rect.anchoredPosition = position;
        rect.sizeDelta = size;
    }

    private static Text CreateText(Transform parent, string name, string value, int fontSize, FontStyle style)
    {
        GameObject item = new GameObject(name, typeof(RectTransform));
        item.transform.SetParent(parent, false);
        Text text = item.AddComponent<Text>();
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.fontSize = fontSize;
        text.fontStyle = style;
        text.color = Color.white;
        text.text = value;
        text.raycastTarget = false;
        return text;
    }

    private static InputField CreateInputField(Transform parent)
    {
        GameObject inputObject = new GameObject("Host IPv4", typeof(RectTransform), typeof(Image), typeof(InputField));
        inputObject.transform.SetParent(parent, false);
        Image background = inputObject.GetComponent<Image>();
        background.color = new Color(0.13f, 0.17f, 0.22f, 1f);
        Text text = CreateText(inputObject.transform, "Text", "", 18, FontStyle.Normal);
        RectTransform textRect = text.rectTransform;
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = new Vector2(10f, 3f);
        textRect.offsetMax = new Vector2(-10f, -3f);
        Text placeholder = CreateText(inputObject.transform, "Placeholder", "Host PC IPv4 address", 16, FontStyle.Italic);
        placeholder.color = new Color(0.75f, 0.78f, 0.82f, 0.75f);
        RectTransform placeholderRect = placeholder.rectTransform;
        placeholderRect.anchorMin = Vector2.zero;
        placeholderRect.anchorMax = Vector2.one;
        placeholderRect.offsetMin = new Vector2(10f, 3f);
        placeholderRect.offsetMax = new Vector2(-10f, -3f);
        InputField field = inputObject.GetComponent<InputField>();
        field.textComponent = text;
        field.placeholder = placeholder;
        field.contentType = InputField.ContentType.Standard;
        field.lineType = InputField.LineType.SingleLine;
        return field;
    }

    private Button CreateButton(Transform parent, string name, string label, Vector2 position)
    {
        GameObject buttonObject = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        buttonObject.transform.SetParent(parent, false);
        Place(buttonObject.GetComponent<RectTransform>(), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), position, new Vector2(250f, 42f));
        Image image = buttonObject.GetComponent<Image>();
        image.color = new Color(0.12f, 0.39f, 0.55f, 1f);
        Button button = buttonObject.GetComponent<Button>();
        button.targetGraphic = image;
        Text text = CreateText(buttonObject.transform, "Label", label, 16, FontStyle.Bold);
        RectTransform labelRect = text.rectTransform;
        labelRect.anchorMin = Vector2.zero;
        labelRect.anchorMax = Vector2.one;
        labelRect.offsetMin = Vector2.zero;
        labelRect.offsetMax = Vector2.zero;
        text.alignment = TextAnchor.MiddleCenter;
        return button;
    }

    private void OnDestroy()
    {
        shuttingDown = true;
        try { listener?.Stop(); } catch { }
        Disconnect();
        EndCapture();
        if (receivedTexture) Destroy(receivedTexture);
    }
}
