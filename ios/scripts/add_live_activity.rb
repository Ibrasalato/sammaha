# Adds the AuctionWidget extension (lock-screen Live Activity + Dynamic Island) and the
# LiveActivity plugin files to App.xcodeproj. Safe to run more than once. Runs in CI before the archive.
require 'xcodeproj'

project_path = File.expand_path('../App/App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)
if project.targets.any? { |t| t.name == 'AuctionWidget' }
  puts 'AuctionWidget already in the project'
  exit 0
end

app = project.targets.find { |t| t.name == 'App' }
app_group = project.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' && g.isa == 'PBXGroup' }
raise 'App group not found' unless app_group

refs = {}
%w[AuctionActivityAttributes.swift LiveActivityPlugin.swift MainViewController.swift].each do |f|
  ref = app_group.files.find { |x| x.path == f } || app_group.new_reference(f)
  refs[f] = ref
  app.source_build_phase.add_file_reference(ref, true)
end

widget = project.new_target(:app_extension, 'AuctionWidget', :ios, '16.2', nil, :swift)
group = project.main_group.new_group('AuctionWidget', 'AuctionWidget')
%w[AuctionWidgetBundle.swift AuctionLiveActivity.swift].each do |f|
  widget.source_build_phase.add_file_reference(group.new_reference(f), true)
end
group.new_reference('Info.plist')
widget.source_build_phase.add_file_reference(refs['AuctionActivityAttributes.swift'], true)
%w[WidgetKit SwiftUI ActivityKit].each { |fw| widget.add_system_framework(fw) }

widget.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'sa.org.ico.sammha.AuctionWidget'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'AuctionWidget/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.2'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
file = embed.add_file_reference(widget.product_reference, true)
file.settings = { 'ATTRIBUTES' => ['RemoveHeaderMirror', 'CodeSignOnCopy'] }
app.add_dependency(widget)

# the app still runs on iOS 15: link ActivityKit weakly
app.build_configurations.each do |c|
  flags = [c.build_settings['OTHER_LDFLAGS'] || '$(inherited)'].flatten
  flags += ['-weak_framework', 'ActivityKit'] unless flags.include?('ActivityKit')
  c.build_settings['OTHER_LDFLAGS'] = flags
end

project.save
puts 'AuctionWidget added'
