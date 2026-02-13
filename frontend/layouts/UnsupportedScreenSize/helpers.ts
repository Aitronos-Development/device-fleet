import url_prefix from "router/url_prefix";

const deviceSelfServiceRegex = new RegExp(
  `^${url_prefix}/device/[^/]+/self-service/?$`,
);

// iOS/iPadOS base device route should support low-width screens
const deviceIOSIPadOSRegex = new RegExp(`^${url_prefix}/device/[^/]+/?$`);

// Add device pages should support low-width screens
const addDeviceRegex = new RegExp(`^${url_prefix}/hosts/add-device(/.*)?$`);

// Define paths that will not show the unsupported screen overlay
const lowWidthSupportedPathsRegex = [
  deviceSelfServiceRegex,
  deviceIOSIPadOSRegex,
  addDeviceRegex,
];

const shouldShowUnsupportedScreen = (locationPathname: string) =>
  !lowWidthSupportedPathsRegex.some((regex) => regex.test(locationPathname));

export default shouldShowUnsupportedScreen;
