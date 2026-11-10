import ActivityKit
import SwiftUI
import WidgetKit

private let pine = Color(red: 0.0, green: 0.32, blue: 0.23)
private let mint = Color(red: 0.42, green: 0.85, blue: 0.55)
private let gold = Color(red: 0.84, green: 0.66, blue: 0.29)
private let alarm = Color(red: 1.0, green: 0.36, blue: 0.36)

private func riyal(_ v: Double) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    f.locale = Locale(identifier: "en_US")
    return "\(f.string(from: NSNumber(value: v)) ?? "\(Int(v))") ر.س"
}

/// Counts down by itself on the lock screen, with no updates from the app.
private struct CountdownText: View {
    let endsAt: Date
    let ended: Bool
    var body: some View {
        if ended || endsAt <= Date() {
            Text("انتهى")
        } else {
            Text(timerInterval: Date()...endsAt, countsDown: true).monospacedDigit()
        }
    }
}

private struct LeadingPill: View {
    let leading: Bool
    var body: some View {
        Text(leading ? "أنت المتصدر حاليًا" : "تم تجاوز مزايدتك")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(leading ? mint : alarm)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .overlay(Capsule().stroke(leading ? mint.opacity(0.6) : alarm.opacity(0.6), lineWidth: 1))
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<AuctionActivityAttributes>
    var body: some View {
        let s = context.state
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("سمّها · متابعة مباشرة", systemImage: "dot.radiowaves.left.and.right")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(.white.opacity(0.8))
                Spacer()
                Text(s.ended ? "انتهى المزاد" : "مزاد جارٍ")
                    .font(.system(size: 11, weight: .bold)).foregroundColor(.white)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(pine))
            }
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("الوقت المتبقي").font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
                    CountdownText(endsAt: s.endsAt, ended: s.ended)
                        .font(.system(size: 26, weight: .heavy)).foregroundColor(gold)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(context.attributes.name).font(.system(size: 20, weight: .heavy)).foregroundColor(.white)
                    Text("أعلى مزايدة: \(riyal(s.price))").font(.system(size: 12, weight: .semibold)).foregroundColor(.white.opacity(0.85))
                }
            }
            if let mine = s.myBid {
                HStack {
                    LeadingPill(leading: s.leading)
                    Spacer()
                    Text("مزايدتك الأخيرة: \(riyal(mine))").font(.system(size: 11)).foregroundColor(.white.opacity(0.8))
                }
            }
        }
        .padding(14)
        .environment(\.layoutDirection, .rightToLeft)
    }
}

struct AuctionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AuctionActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.03, green: 0.16, blue: 0.13).opacity(0.92))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "sammha://auctions/\(context.attributes.auctionId)"))
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.name).font(.system(size: 17, weight: .heavy))
                        Text(context.attributes.typeLabel).font(.system(size: 11)).foregroundColor(.secondary)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CountdownText(endsAt: s.endsAt, ended: s.ended)
                        .font(.system(size: 17, weight: .heavy)).foregroundColor(alarm)
                        .frame(maxWidth: 90)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("أعلى مزايدة: \(riyal(s.price))").font(.system(size: 13, weight: .semibold))
                        Spacer()
                        if s.myBid != nil { LeadingPill(leading: s.leading) }
                    }
                    .environment(\.layoutDirection, .rightToLeft)
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: "dot.radiowaves.left.and.right").foregroundColor(mint)
                    Text(context.attributes.name).font(.system(size: 12, weight: .bold)).lineLimit(1)
                }
            } compactTrailing: {
                CountdownText(endsAt: s.endsAt, ended: s.ended)
                    .font(.system(size: 12, weight: .bold)).foregroundColor(alarm)
                    .frame(maxWidth: 58)
            } minimal: {
                Image(systemName: "hammer.fill").foregroundColor(mint)
            }
            .widgetURL(URL(string: "sammha://auctions/\(context.attributes.auctionId)"))
            .keylineTint(mint)
        }
    }
}
