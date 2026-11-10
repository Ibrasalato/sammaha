import ActivityKit
import Foundation

/// One followed auction on the lock screen and in the Dynamic Island.
/// Shared by the app (which starts and updates it) and the AuctionWidget extension (which draws it).
@available(iOS 16.1, *)
struct AuctionActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var price: Double
        var endsAt: Date
        var leading: Bool
        var myBid: Double?
        var ended: Bool
    }

    var auctionId: String
    var name: String
    var typeLabel: String
}
