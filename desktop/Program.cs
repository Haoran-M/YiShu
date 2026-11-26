using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("YiShu")]
[assembly: AssemblyCompany("YiShu")]
[assembly: AssemblyProduct("YiShu")]
[assembly: AssemblyVersion("1.3.1.0")]
[assembly: AssemblyFileVersion("1.3.1.0")]

namespace YiShu
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new YiShuWindow());
        }
    }

    internal sealed class YiShuWindow : Form
    {
        private static readonly Uri Origin = new Uri("https://app.yishu.invalid/");
        private readonly string assets = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "website");
        private readonly WebView2 view;

        internal YiShuWindow()
        {
            Text = "YiShu · I Ching Companion";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(1170, 795);
            MinimumSize = new Size(410, 565);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            BackColor = Color.FromArgb(246, 243, 235);
            view = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
            Controls.Add(view);
            Shown += OnShown;
        }

        private async void OnShown(object sender, EventArgs args)
        {
            try
            {
                if (!File.Exists(Path.Combine(assets, "index.html")))
                    throw new DirectoryNotFoundException("Missing packaged website.");

                var userData = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YiShu", "WebView2");
                var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
                if (IsDisposed) return;
                await view.EnsureCoreWebView2Async(environment);
                if (IsDisposed) return;

                var core = view.CoreWebView2;
                core.SetVirtualHostNameToFolderMapping(Origin.Host, assets, CoreWebView2HostResourceAccessKind.DenyCors);
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsBuiltInErrorPageEnabled = false;
                core.NavigationStarting += OnNavigationStarting;
                core.NewWindowRequested += OnNewWindowRequested;
                core.DownloadStarting += OnDownloadStarting;
                core.Navigate(Origin.AbsoluteUri + "index.html");
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show(this, "Install Microsoft Edge WebView2 Runtime to open YiShu.", Text,
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            catch (Exception error)
            {
                Debug.WriteLine(error);
                MessageBox.Show(this, "Unable to start YiShu. Extract the entire ZIP before running YiShu.exe.", Text,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args)
        {
            Uri uri;
            if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out uri)) { args.Cancel = true; return; }
            if (Origin.IsBaseOf(uri)) return;
            args.Cancel = true;
            if (args.IsUserInitiated && uri.Scheme == Uri.UriSchemeHttps) OpenOutside(uri.AbsoluteUri);
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
            Uri uri;
            if (!args.IsUserInitiated || !Uri.TryCreate(args.Uri, UriKind.Absolute, out uri)
                || uri.Scheme != Uri.UriSchemeHttps) return;
            if (!Origin.IsBaseOf(uri))
            {
                OpenOutside(uri.AbsoluteUri);
            }
            else if (uri.AbsolutePath == "/assets/cc-by-sa-4.0.txt")
            {
                OpenOutside(Path.Combine(assets, "assets", "cc-by-sa-4.0.txt"));
            }
        }

        private void OpenOutside(string destination)
        {
            try { Process.Start(new ProcessStartInfo(destination) { UseShellExecute = true }); }
            catch { MessageBox.Show(this, "无法打开此链接。", Text, MessageBoxButtons.OK, MessageBoxIcon.Information); }
        }

        private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs args)
        {
            args.Handled = true;
            if (!args.DownloadOperation.Uri.StartsWith("blob:" + Origin.AbsoluteUri, StringComparison.Ordinal))
            {
                args.Cancel = true;
                return;
            }

            var deferral = args.GetDeferral();
            BeginInvoke(new Action(() =>
            {
                try
                {
                    using (var dialog = new SaveFileDialog())
                    {
                        var filename = Path.GetFileName(args.ResultFilePath);
                        dialog.FileName = filename == "yishu-birth-profiles.json" ? filename : "yishu-history.json";
                        dialog.Filter = "JSON (*.json)|*.json";
                        dialog.AddExtension = true;
                        dialog.OverwritePrompt = true;
                        if (dialog.ShowDialog(this) == DialogResult.OK) args.ResultFilePath = dialog.FileName;
                        else args.Cancel = true;
                    }
                }
                finally { deferral.Complete(); }
            }));
        }
    }
}
