# Arena Shooter

A small, editable Unity 3D first person shooter prototype for Unity `6000.6.7f1`.
The project builds its starter scene from regular Unity objects and C# scripts, so you can
change the arena, player, weapon, UI, and target behavior in the Editor.

## Open and play

1. Open this folder in Unity Hub with Unity `6000.6.7f1`.
2. Let Unity finish importing and compiling. The Editor script creates `Assets/Scenes/Arena.unity`
   and opens the starter scene automatically the first time.
3. Press **Play** in the Editor.

Controls: **WASD** move, **mouse** aim, **left mouse button** fire, **Escape** unlock/relock the
cursor, and **R** restart after defeat. Aim at red target bots to damage them. Bots pursue and
attack when close enough. The player starts with 100 health.

The camera uses a **70° vertical field of view** by default. A soft radial mask keeps the center
clear and fades the edges to black. Tune `Player Field Of View`, `Vision Clear Radius`,
`Vision Fade Width`, and `Vision Darkness` under **Arena Settings**. FOV here means the camera's
vertical angle; Unity expands the horizontal view to fit the game window.

## Tuning

Select **Arena Settings** in the generated scene. Its Inspector fields expose arena radius and
thickness, player health/height/radius/speed/sensitivity, weapon damage/fire rate/range, and the
number, health, damage, rate, and speed of the target bots. The scripts under `Assets/Scripts`
contain the movement, health, weapon, bot, and HUD behavior and can be edited directly.

The arena mesh and target layout are generated from the settings when the scene is built. If you
change arena dimensions or target count and want to regenerate their layout, use
**Tools > Arena Shooter > Build or Reset Demo Arena**. This rebuilds the generated scene and its
mesh/material assets; save a copy of any manual scene edits first.

The visual style is intentionally a simple colored-blockout so it is easy to replace the capsule
characters, colors, and environment with your own art.

## Two-PC swapped POV prototype

The generated scene includes a direct local-network POV link. Put both Windows PCs on the same
private 5 GHz Wi-Fi network. Start the game on PC 1 and click **HOST THIS PC**. The host panel
shows its private IPv4 address. On PC 2, enter that address and click **JOIN HOST IP**. If Windows
Firewall asks, allow the game on **Private networks**. Both screens then show the other PC's live
camera feed while WASD, mouse aim, and firing remain local to that PC.

The arena stays visible and gameplay waits until the link connects, so bots cannot defeat you
while you enter the address. If the link drops, the connection panel returns and you can Host or
Join again without restarting. Join reports a timeout after five seconds. For a timeout, confirm
that both PCs are on the same local network, use the IPv4 address shown on the host (not the
joiner's address), and allow inbound TCP port `27940` for the game on the host PC's Private
Windows Firewall profile. Before joining, run `Test-NetConnection HOST_IP -Port 27940` on the
second PC, replacing `HOST_IP` with the IP shown by the host. `TcpTestSucceeded` must be `True`.
If it is `False`, the network or host firewall is blocking the connection before Unity can
exchange video. Campus and guest Wi-Fi often prevent devices from reaching each other; a private
router or a Windows Mobile Hotspot with both laptops connected is a better local setup. Keep the
host network set to **Private**, and allow the Editor or built game through its Private firewall
profile. Avoid opening this game port on a campus or other Public network.

When connected, the top-right readout shows game FPS and actual video frames sent and received
per second. The target is 30 video frames per second. If game FPS is below 30, lower
`Stream Width`, `Stream Height`, or `Jpeg Quality` in the `LanPovLink` Inspector on both PCs.

This is a video-link prototype: it sends each camera as JPEG frames over a direct TCP connection
and does not require a cloud service, a relay, or a separate signaling application. It does not yet
synchronize arena objects, hits, health, or match state between the two copies of the game. Video
resolution, frame rate, JPEG quality, and port are editable on the `LanPovLink` component. The
defaults are 640x360 at a 30 fps target; actual delay and smoothness depend on Wi-Fi congestion
and both PCs' encoding performance, so sub-100 ms delay is not guaranteed.

The current scene receives the component through **Tools > Arena Shooter > Add LAN POV Link to
Existing Scene**. New scenes created with **Build or Reset Demo Arena** also include it.
