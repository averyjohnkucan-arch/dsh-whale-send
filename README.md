# Whale Send for DeepSeek Harness RC4

In **Plugins → Add plugin**, paste `https://github.com/averyjohnkucan-arch/dsh-whale-send` and enable **Whale Send**. Send the first message in a new web chat with the Send button or Enter. The conversation controls fade away over the first 500 milliseconds. The welcome heading fades with the controls. The sidebar stays visible and interactive throughout. Your submitted message floats from the composer to the center of the screen over the first 500 milliseconds. The whale moves behind it at 27% opacity in the stock RC4 theme, halfway between the original 18% and the previous plugin’s 36%. The last 500 milliseconds of the 5.7-second animation reveal the full, live chat. The message is submitted immediately. Click or press a key in the conversation to reveal the conversation sooner.

Requires DeepSeek Harness 0.2.2-rc.4 and its official brand plugin. The effect respects the browser’s reduced-motion preference and uses the whale artwork shipped with the host. Subsequent messages use the standard chat UI.

Open **Settings → Whale Send → Whale style** to choose how the whale appears.

- **LED matrix** draws the whale in dots. This is the default.
- **Text/code** fills the moving silhouette with DeepSeek’s original code lettering.
- **Random per chat** gives each style an equal chance on the first send in a new chat. The selected style lasts for the whole animation.

**Dithering** makes the LED dots flicker independently at up to 40 updates per second. **Water ripple background** adds a shifting pool-light pattern behind either style. Both switches start on. Your choices are saved in the current browser.
