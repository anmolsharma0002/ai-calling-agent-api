const versions = {
    v1: require('./v1/routes'),
    // Add new versions here as they are created
};

const getVersion = (version) => {
    if (!versions[version]) {
        throw new Error(`API version ${version} not found`);
    }
    return versions[version];
};

const getLatestVersion = () => {
    const versionKeys = Object.keys(versions);
    return versions[versionKeys[versionKeys.length - 1]];
};

module.exports = {
    versions,
    getVersion,
    getLatestVersion
}; 