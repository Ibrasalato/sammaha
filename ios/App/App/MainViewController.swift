import Capacitor
import UIKit

/// The app's web view controller: registers the plugins that live inside the app target.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
