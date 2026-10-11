# Pinned OpenClaw source for nix-openclaw
{
  owner = "openclaw";
  repo = "openclaw";
  pnpmMajor = "12";
  applyPublicSurfaceHardlinksPatch = false;
  applySkipPluginAutoEnableNixModePatch = false;
  applyNixStorePluginOwnershipPatch = true;
  releaseTag = "v2026.10.1";
  releaseVersion = "2026.10.1";
  runtimePluginVersion = "2026.10.1";
  rev = "e178c39e9aae3fa440735217f9aef9574f286677";
  hash = "sha256-KWbh0iUzav08tohNFh76T2vIALfd5un5w3RHDCfe8yw=";
  gatewayNpmDepsHash = "sha256-M0gNiajq/IQjpcOyD9KMuIanUnMAwET8xwnD/0F/G90=";
}
