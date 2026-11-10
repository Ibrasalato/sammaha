import ActivityKit
import Capacitor
import Foundation

/// JS name "LiveActivity": start / update / end the lock-screen live activity of a followed auction.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.reject("Live Activities need iOS 16.2"); return }
        guard let id = call.getString("id"), let name = call.getString("name") else { call.reject("id and name are required"); return }
        let state = Self.state(from: call)
        if let running = Activity<AuctionActivityAttributes>.activities.first(where: { $0.attributes.auctionId == id }) {
            Task {
                await running.update(ActivityContent(state: state, staleDate: nil))
                call.resolve(["id": running.id])
            }
            return
        }
        do {
            let attributes = AuctionActivityAttributes(auctionId: id, name: name, typeLabel: call.getString("typeLabel") ?? "")
            let activity = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil), pushType: nil)
            call.resolve(["id": activity.id])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard let id = call.getString("id") else { call.reject("id is required"); return }
        let state = Self.state(from: call)
        let matches = Activity<AuctionActivityAttributes>.activities.filter { $0.attributes.auctionId == id }
        Task {
            for activity in matches {
                if state.ended {
                    await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
                } else {
                    await activity.update(ActivityContent(state: state, staleDate: nil))
                }
            }
            call.resolve(["updated": matches.count])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let id = call.getString("id")
        let matches = Activity<AuctionActivityAttributes>.activities.filter { id == nil || $0.attributes.auctionId == id }
        Task {
            for activity in matches { await activity.end(nil, dismissalPolicy: .immediate) }
            call.resolve(["ended": matches.count])
        }
    }

    @objc func list(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["ids": []]); return }
        call.resolve(["ids": Activity<AuctionActivityAttributes>.activities.map { $0.attributes.auctionId }])
    }

    @available(iOS 16.2, *)
    private static func state(from call: CAPPluginCall) -> AuctionActivityAttributes.ContentState {
        let endsAtMs = call.getDouble("endsAt") ?? Date().timeIntervalSince1970 * 1000
        return AuctionActivityAttributes.ContentState(
            price: call.getDouble("price") ?? 0,
            endsAt: Date(timeIntervalSince1970: endsAtMs / 1000),
            leading: call.getBool("leading") ?? false,
            myBid: call.getDouble("myBid"),
            ended: call.getBool("ended") ?? false
        )
    }
}
