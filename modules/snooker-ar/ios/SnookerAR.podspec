Pod::Spec.new do |s|
  s.name           = 'SnookerAR'
  s.version        = '1.0.0'
  s.summary        = 'ARKit table view for Scan Snooker in Snooker Lab'
  s.description    = 'Finds the table, reports camera rays for calibration and scanning, and draws balls and table lines.'
  s.license        = 'UNLICENSED'
  s.author         = 'Snooker Lab'
  s.homepage       = 'https://snookeredapp.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ARKit', 'SceneKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
