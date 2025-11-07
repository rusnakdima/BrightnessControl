# Brightness Control GNOME Extension

A GNOME Shell extension that adds a brightness indicator to Quick Settings with scroll wheel support for easy brightness adjustment.

## Features

- Adds a brightness icon to the Quick Settings panel in the top-right of the screen
- Allows adjustment of screen brightness using mouse scroll wheel
- Scroll up to increase brightness, scroll down to decrease brightness
- Brightness level is constrained between 0% and 100%
- Clean and intuitive interface that integrates with GNOME's design

## Installation

### From GNOME Extensions Website

1. Visit [the extension page](https://extensions.gnome.org/extension/your-extension-id/)
2. Toggle the switch to ON to install the extension
3. The brightness control will appear in your Quick Settings panel

### Manual Installation

1. Download the `brightness-control@rusnakdima.github.com.zip` file
2. Open the terminal and navigate to the directory containing the ZIP file
3. Run the following command:
   ```bash
   gnome-extensions install brightness-control@rusnakdima.github.com.zip
   ```
4. Enable the extension using the GNOME Extensions app or by running:
   ```bash
   gnome-extensions enable brightness-control@rusnakdima.github.com
   ```

## Usage

1. Look for the brightness icon (display-brightness-symbolic) in the Quick Settings panel (click the power icon in the top-right)
2. Scroll up with your mouse wheel over the brightness icon to increase brightness
3. Scroll down with your mouse wheel to decrease brightness
4. The brightness level will be adjusted in 5% increments

## Compatibility

- GNOME Shell versions: 45, 46, 47, 48, 49
- Works with any display that supports the GNOME Settings Daemon brightness controls

## Troubleshooting

If the extension is not working:

1. Make sure you have the latest version installed
2. Check that your display supports brightness adjustment through the system
3. Look for any error messages in the journal with:
   ```bash
   journalctl -f | grep -i brightness
   ```
4. If the extension is misbehaving, disable and re-enable it through the GNOME Extensions app

## Uninstallation

To uninstall the extension:

1. Using GNOME Extensions app: Simply disable and remove the extension
2. Using command line:
   ```bash
   gnome-extensions uninstall brightness-control@rusnakdima.github.com
   ```

## Contributing

If you find any issues or have suggestions for improvements, feel free to open an issue on the GitHub repository at [https://github.com/rusnakdima/BrightnessControl](https://github.com/rusnakdima/BrightnessControl).

## License

This extension is licensed under the MIT License. See the [LICENSE](./LICENSE.MD) file for more information.
