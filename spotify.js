var Spotify =
    function ($http, $q) {
        'use strict';
        var Spotify = {};
        Spotify.getPlaylistTracks = function(playlistURL, snapshotID, accessToken) {
            console.log("Getting playlist tracks...");
            var d = $q.defer();
            var snapshotArray = localStorage["snapshot-" + snapshotID];
            if (snapshotArray) {
                console.log("Retrieving snapshot from memory...", snapshotID);
                d.resolve(JSON.parse(snapshotArray));
                return d.promise;
            }
            var allPlaylistTracks = [];
            function appendPlaylists(nextURL) {
                if (nextURL === null) {
                    console.log("Resolving playlist tracks...", allPlaylistTracks);
                    d.resolve(allPlaylistTracks);
                    return;
                }
                if (typeof nextURL === 'undefined') {
                    d.reject();
                    return;
                }
                //Append playlists to the menu
                $http({
                    method: 'GET',
                    url: nextURL,
                    headers: {
                        'Authorization': 'Bearer ' + accessToken
                    }
                })
                .then(function(result) {
                        var playlists = result.data;
                        for (var i = 0; i < playlists.items.length; i++) {
                            allPlaylistTracks.push(playlists.items[i]);
                        }
                        appendPlaylists(playlists.next);
                    },
                    function (e) {
                        d.reject(e);
                    }
                );
            }
            appendPlaylists(playlistURL);
            return d.promise;
        };

        Spotify.getUserData = function (accessToken) {
            return $http({
                method: 'GET',
                url: 'https://api.spotify.com/v1/me',
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                }
            });
        };

        Spotify.getUserPlaylistData = function (accessToken, userid) {
            return $http({
                method: 'GET',
                url: 'https://api.spotify.com/v1/users/' + userid + '/playlists?limit=50',
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                }
            });
        };

        Spotify.addTracksToCompactPlaylist = function (playlistURL, tracksList, accessToken) {
            return $http({
                url: playlistURL + "/tracks",
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    uris: tracksList
                })
            });
        };

        Spotify.createCompactPlaylist = function (playlistName, accessToken, userid, name) {
            return $http({
                url: 'https://api.spotify.com/v1/users/' + userid + '/playlists',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    name: playlistName || "[Compact] Generated playlist",
                    description: "This playlist is a compact version of '" + playlistName + "', created on " + (new Date()).toString()
                })
            });
        };

        return Spotify;
    };
