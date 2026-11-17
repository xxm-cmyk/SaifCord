using System.Diagnostics;
using System.IO;
using Path = System.IO.Path;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Interop;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;

namespace SaudiCord.Setup;

public partial class MainWindow : Window
{
    private readonly List<Rectangle> _cells = [];
    private Point _mouse;
    private bool _animationEnabled = true;
    private bool _busy;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += (_, _) => BuildGrid();
        SourceInitialized += (_, _) => ApplyNativeDarkTitleBar();
        SizeChanged += (_, _) => BuildGrid();
        MouseMove += (_, e) => _mouse = e.GetPosition(GridCanvas);
        CompositionTarget.Rendering += AnimateGrid;
        StateChanged += (_, _) => UpdateWindowStateGlyph();
        UpdateWindowStateGlyph();
        Log("مرحباً بك في مثبّت SaudiCord المستقل.");
        Log("اختر تثبيت أو إصلاح أو إزالة للمتابعة.");
    }

    private static string PayloadDirectory =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SaudiCord", "InstallerPayload");


    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int valueSize);

    private void ApplyNativeDarkTitleBar()
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd == IntPtr.Zero) return;

        // Retain native Windows caption controls while blending the caption into the app surface.
        var darkMode = 1;
        _ = DwmSetWindowAttribute(hwnd, 20, ref darkMode, sizeof(int));
        _ = DwmSetWindowAttribute(hwnd, 19, ref darkMode, sizeof(int));

        // Explicit caption colors are supported on Windows 11; older versions ignore them.
        var captionColor = 0x000C0808;
        var textColor = 0x00F2F7F3;
        _ = DwmSetWindowAttribute(hwnd, 35, ref captionColor, sizeof(int));
        _ = DwmSetWindowAttribute(hwnd, 36, ref textColor, sizeof(int));
    }

    private void BuildGrid()
    {
        GridCanvas.Children.Clear();
        _cells.Clear();
        const double step = 38;
        for (double y = 0; y < ActualHeight + step; y += step)
        for (double x = 0; x < ActualWidth + step; x += step)
        {
            var square = new Rectangle
            {
                Width = 2,
                Height = 2,
                RadiusX = 0.5,
                RadiusY = 0.5,
                Fill = new SolidColorBrush(Color.FromRgb(54, 232, 121)),
                Opacity = 0.12
            };
            Canvas.SetLeft(square, x);
            Canvas.SetTop(square, y);
            GridCanvas.Children.Add(square);
            _cells.Add(square);
        }
    }

    private void AnimateGrid(object? sender, EventArgs e)
    {
        if (!_animationEnabled || !IsLoaded) return;
        foreach (var cell in _cells)
        {
            var x = Canvas.GetLeft(cell) + 1;
            var y = Canvas.GetTop(cell) + 1;
            var distance = Math.Sqrt(Math.Pow(x - _mouse.X, 2) + Math.Pow(y - _mouse.Y, 2));
            var influence = Math.Max(0, 1 - distance / 190);
            cell.Opacity = 0.08 + influence * 0.62;
            var size = 2 + influence * 3;
            cell.Width = size;
            cell.Height = size;
        }
    }

    private void Log(string message)
    {
        LogBox.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}{Environment.NewLine}");
        LogBox.ScrollToEnd();
    }

    private async Task SetBusy(bool busy)
    {
        _busy = busy;
        InstallButton.IsEnabled = RepairButton.IsEnabled = UninstallButton.IsEnabled = KillButton.IsEnabled = !busy;
        ActivityBar.IsIndeterminate = busy;
        await Task.CompletedTask;
    }

    private async Task<bool> ConfirmDiscordClose()
    {
        var answer = MessageBox.Show(
            "سيتم إغلاق جميع نوافذ وعمليات Discord وSaudiCord المفتوحة. احفظ عملك أولاً. هل تريد المتابعة؟",
            "تأكيد إغلاق Discord", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        return answer == MessageBoxResult.Yes;
    }

    private static string[] DiscordProcessNames =>
        ["Discord", "DiscordPTB", "DiscordCanary", "SaudiCord"];

    private async Task CloseDiscordProcesses()
    {
        foreach (var name in DiscordProcessNames)
        {
            foreach (var process in Process.GetProcessesByName(name))
            {
                try
                {
                    if (process.MainWindowHandle != IntPtr.Zero)
                        process.CloseMainWindow();
                }
                catch { }
            }
        }

        await Task.Delay(2200);
        foreach (var name in DiscordProcessNames)
        {
            foreach (var process in Process.GetProcessesByName(name))
            {
                try
                {
                    if (!process.HasExited)
                        process.Kill(entireProcessTree: true);
                }
                catch (Exception ex)
                {
                    Log($"تعذّر إغلاق إحدى عمليات {name}: {ex.Message}");
                }
            }
        }
    }

    private static void ExtractPayload()
    {
        Directory.CreateDirectory(PayloadDirectory);
        var assembly = Assembly.GetExecutingAssembly();
        var names = new[]
        {
            ("SaudiCord.Payload.node.exe", "node.exe"),
            ("SaudiCord.Payload.install.mjs", "install.mjs"),
            ("SaudiCord.Payload.asar.mjs", "asar.mjs"),
            ("SaudiCord.Payload.saudicord.asar", "saudicord.asar")
        };

        foreach (var (resource, file) in names)
        {
            using var input = assembly.GetManifestResourceStream(resource)
                ?? throw new FileNotFoundException($"ملف المثبّت المضمّن غير موجود: {resource}");
            var destination = Path.Combine(PayloadDirectory, file);
            using var output = File.Create(destination);
            input.CopyTo(output);
        }
    }

    private async Task RunInstaller(bool uninstall)
    {
        if (_busy) return;
        if (!await ConfirmDiscordClose()) return;

        await SetBusy(true);
        try
        {
            Log(uninstall ? "بدء إزالة SaudiCord واستعادة Discord..." : "بدء تجهيز ملفات SaudiCord...");
            await CloseDiscordProcesses();
            ExtractPayload();

            var node = Path.Combine(PayloadDirectory, "node.exe");
            var script = Path.Combine(PayloadDirectory, "install.mjs");
            var args = uninstall ? $"\"{script}\" --uninstall --branch stable" : $"\"{script}\" --branch stable";
            var start = new ProcessStartInfo(node, args)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = PayloadDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            using var process = new Process { StartInfo = start };
            process.OutputDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Dispatcher.Invoke(() => Log(e.Data)); };
            process.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Dispatcher.Invoke(() => Log("خطأ: " + e.Data)); };
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                Log(uninstall ? "اكتملت الإزالة واستعادة Discord الأصلي." : "اكتمل تثبيت SaudiCord بنجاح.");
                MessageBox.Show(uninstall ? "تمت إزالة SaudiCord واستعادة Discord." : "تم تثبيت SaudiCord. افتح Discord لتطبيق التغييرات.",
                    "SaudiCord", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                Log($"انتهت العملية برمز خطأ {process.ExitCode}. راجع سجل المثبّت.");
                MessageBox.Show("لم تكتمل العملية. راجع سجل العمليات لمعرفة السبب.", "تعذّر إكمال العملية",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
        catch (Exception ex)
        {
            Log("فشل: " + ex.Message);
            MessageBox.Show(ex.Message, "خطأ في المثبّت", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            await SetBusy(false);
        }
    }

    private async void InstallButton_Click(object sender, RoutedEventArgs e) => await RunInstaller(false);
    private async void RepairButton_Click(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show("سيُعاد تطبيق ملفات SaudiCord على Discord. هل تريد المتابعة؟",
            "إصلاح SaudiCord", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
            await RunInstaller(false);
    }
    private async void UninstallButton_Click(object sender, RoutedEventArgs e) => await RunInstaller(true);

    private async void KillButton_Click(object sender, RoutedEventArgs e)
    {
        if (!await ConfirmDiscordClose()) return;
        await SetBusy(true);
        try
        {
            await CloseDiscordProcesses();
            Log("تم إرسال طلب إغلاق لجميع عمليات Discord وSaudiCord.");
        }
        finally { await SetBusy(false); }
    }

    private void SettingsButton_Click(object sender, RoutedEventArgs e) => SettingsOverlay.Visibility = Visibility.Visible;

    private void CloseSettings_Click(object sender, RoutedEventArgs e)
    {
        _animationEnabled = AnimationToggle.IsChecked == true ? false : true;
        SettingsOverlay.Visibility = Visibility.Collapsed;
        Log(_animationEnabled ? "تم تفعيل حركة الخلفية." : "تم تعطيل حركة الخلفية لتقليل استهلاك الموارد.");
    }

    protected override void OnClosed(EventArgs e)
    {
        CompositionTarget.Rendering -= AnimateGrid;
        base.OnClosed(e);
    }
}