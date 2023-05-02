
angular
.module('compactify', ['ngRoute'])
.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix('');
    $routeProvider
        .when('/', {
            templateUrl: 'main.html'
        })
        .when('/main', {
            templateUrl: 'main.html'
        })
        .when('/compactify', {
            templateUrl: 'authSuccess.html',
            controller: 'success'
        })
        .when('/followedArtists', {
            templateUrl: 'followArtists.html',
            controller: 'followArtists'
        })
        .when('/twc', {
            templateUrl: 'followArtists.html',
            controller: 'twc'
        })
        .when('/noAuth', {
            templateUrl: 'noAuth.html',
            controller: 'needsAuth'
        })
        .when('/access_token=:accessToken', {
            template: ' ',
            controller: 'authorizing'
        })
        .otherwise({
            redirectTo: '/noAuth'
        });
    $locationProvider.html5Mode(true);
}])
.service('Spotify', Spotify)
.controller('authorizing', function($scope, $routeParams) {
    let hashToken = $routeParams.accessToken.split("&")[0];
    if (hashToken) {
        console.log(hashToken);
        window.opener.postMessage(JSON.stringify({ type: "access_token", access_token: hashToken }), window.location.origin);
        window.close();
    }
    else {
        showMessage("There was an error processing your request");
    }
})
.controller('twc', function($scope, $location, $timeout, Spotify) {
    //$('body').addClass('loading');
    let logout = function() {
        $timeout(function() {
            delete localStorage.SpotifyAuthToken;
            $location.path('/noAuth').replace();
            $scope.$apply();
        });
    };
    if (!localStorage.SpotifyAuthToken) {
        logout();
        return;
    }
    $(".allAlbums").empty();
    let songs = [];
    let wait = function() {
        return new Promise((r) => {
            setTimeout(function() {
                r();
            }, 1200);
        });
    };
    $.ajax({
        url: 'getHtml.php?url=https://twcclassics.com/audio/years.html'
    })
    .done(function(response) {
        let yearsHtml = response;
        $(yearsHtml).find('h2 a').each(function() {
            let $year = $(this);
            $.ajax({
                url: 'getHtml.php?url=https://twcclassics.com/audio/' + $year.attr('href')
            })
            .done(function(yearResponse) {
                (async function() {
                    let $currYear = $(yearResponse);
                    let firstArtistRow = $currYear.find('.row strong').parents('.row').next();
                    while (firstArtistRow.hasClass('row')) {
                        let artist = firstArtistRow.children().eq(0).text();
                        let songRows = firstArtistRow.find('a');
                        for (let i = 0; i < songRows.length; i++) {
                            let $song = songRows[i];

                            let s = artist + ' - ' + $($song).text();
                            if (!songs.includes(s)) {
                                songs.push(s);
                                Spotify.searchForTrack(s, localStorage.SpotifyAuthToken).then(function(sResponse) {
                                    sResponse = sResponse.data;
                                    if (!sResponse || !sResponse.tracks) {
                                        return false;
                                    }
                                    let tID = sResponse.tracks.items.length ? sResponse.tracks.items[0].uri : null;
                                    if (tID) {
                                        Spotify.addTracksToCompactPlaylist('https://api.spotify.com/v1/playlists/3TVlahwvHR8lK9MIgx59GK', [tID], localStorage.SpotifyAuthToken);
                                    }
                                });
                            }
                            await wait();
                        }

                        firstArtistRow = firstArtistRow.next();
                        await wait();
                    }
                })();
            });
        });
    });
})
.controller('followArtists', function($scope, $location, $timeout, Spotify) {

    $('body').addClass('loading');
    let logout = function() {
        $timeout(function() {
            delete localStorage.SpotifyAuthToken;
            $location.path('/noAuth').replace();
            $scope.$apply();
        });
    };
    if (!localStorage.SpotifyAuthToken) {
        logout();
        return;
    }
    $(".allAlbums").empty();
    Spotify.getFollowedArtists(localStorage.SpotifyAuthToken)
    .then(function(followedArtistsResponse) {
        $(".allAlbums").empty();
        let followedArtists = followedArtistsResponse.data.artists.items;
        if (followedArtists.length === 0) {
            $(".allAlbums").text("You don't follow any artists!");
            return;
        }
        let artistsArray = followedArtists.map(function(t) { return t.id; });
        //let artistMap = {};
        let albumsInOrder = [];
        let artistsProcessed = 0;
        let totalArtistsToProcess = artistsArray.length;
        let processedAlbums = [];
        let printArtistWithAlbum = function(artistID) {
            Spotify.getAlbumsForArtist(artistID, localStorage.SpotifyAuthToken)
            .then(function(t) {
                /*let name = followedArtists.filter(function(t) {
                    return t.id === artistID;
                })[0].name;
                artistMap[artistID] = name;*/
                let albumsForArtist = t.data.items.filter(function(album) {
                    return (album.album_group === 'album' || (album.album_group === 'single' && album.total_tracks > 2)) && !album.name.toLowerCase().includes("remix"); //filter out singles and shit
                });
                Array.prototype.push.apply(albumsInOrder, albumsForArtist);
                artistsProcessed++;
                if (artistsProcessed === totalArtistsToProcess) {
                    albumsInOrder = albumsInOrder.sort(function(a,b) {
                        return new Date(b.release_date) - new Date(a.release_date);
                    });
                    albumsInOrder.forEach(function(album) {
                        let artistName = album.artists[0].name;
                        let displayName = artistName + " - '" + album.name;
                        if (!processedAlbums.includes(displayName)) {
                            $(".allAlbums").append("<div class='followedArtist' data-year='" + new Date(album.release_date).getFullYear() + "' data-artist='" + artistName + "'><img class='albumArt' src='" + album.images[0].url + "' /><span>" + displayName + "' (" + album.release_date + ")");
                            processedAlbums.push(displayName);
                        }
                    });

                    $('body').removeClass('loading');
                }
            });
        };
        artistsArray.forEach(printArtistWithAlbum);
    }, logout);
})
.controller('success', ["$scope", "$location", "$q", "Spotify", "$timeout", function ($scope, $location, $q, Spotify, $timeout) {
    $scope.loading = true;
    let logout = function() {
        delete localStorage.SpotifyAuthToken;
        $location.path('/noAuth').replace();
    };
    if (!localStorage.SpotifyAuthToken) {
        logout();
        return;
    }


    $scope.highlightRow = function() {
        $timeout(() => {
            $scope.selectedPlaylistsActual = Object.keys($scope.selectedPlaylists).filter(key => $scope.selectedPlaylists[key]);
            $scope.playlistName = $scope.selectedPlaylistsActual.length ? "[Compact] " + $scope.selectedPlaylistsActual.map(key => $scope.playlists.find(t => t.id === key).name).join("+") || "Custom Playlist" : '';
        });
    };

    $scope.selectedPlaylists = {};
    $scope.createClick = async function() {
        console.log("Creating custom playlist...");
        $scope.loading = true;
        let selectedPlaylist;
        if ($('.playlists .selectedPlaylist.customURILabel').length) {
            let uri = $('.customURI').val();
            let matches = (/spotify:user:([a-zA-Z0-9]+):playlist:([a-zA-Z0-9]{22})/g).exec(uri);
            if (!matches || matches.length !== 3) {
                $scope.loading = false;
                showMessage("Your custom Spotify URI was invalid.");
                return;
            }
            else {
                selectedPlaylist = "https://api.spotify.com/v1/users/@USER/playlists/@PLAYLIST/tracks".replace("@USER", matches[1]).replace("@PLAYLIST", matches[2]);
            }
        }
        else {
            selectedPlaylist = $('.playlists .selectedPlaylist input[type=radio]:checked').val();
        }
        console.log("Selected playlists", $scope.selectedPlaylistsActual);

        let selectedPlaylistName = $('#playlistName').val();
        let selectedPlaylistSnapshot = $('.playlists input[type=radio]:checked').attr('data-snapshot');
        //let deferredItems = [];
        function showGenericError(e) {
            console.warn("Error creating compact playlist object", e);
            showMessage("There was an issue creating your compact playlist");
            $scope.loading = false;
        }
        try {
            let allTracks = (await Promise.all(
                $scope.selectedPlaylistsActual
                .map(playlistId => {
                    let url = "https://api.spotify.com/v1/users/@USER/playlists/@PLAYLIST/tracks".replace("@USER", $scope.user.id).replace("@PLAYLIST", playlistId);
                    return Spotify.getPlaylistTracks(url, null, localStorage.SpotifyAuthToken);
                })
            )).flat();
            console.log("Got tracks", allTracks.length);
            //we want to cache by snapshot ID so we don't have to make a bunch of extra requests to spotify later on
            if (!localStorage["snapshot-" + selectedPlaylistSnapshot]) {
                //localStorage["snapshot-" + selectedPlaylistSnapshot] = JSON.stringify(allTracks);
            }

            let maxDurationCount = parseInt($("#maxDurationCount").val()) || 60;
            let UOMInMilli = parseInt($("#UOM option:selected").val()) || 60000;
            let maxDurationInMilliSec = maxDurationCount * UOMInMilli;
            let userSongLimit = parseInt($('#songLimit').val());
            let compactedTracks = compactTracks(
                allTracks,
                userSongLimit,
                maxDurationInMilliSec,
                parseInt($("#varianceLevel").val())
            );

            console.log("Generating new playlist");
            let playlist = (await Spotify.createCompactPlaylist(selectedPlaylistName, localStorage.SpotifyAuthToken, localStorage.SpotifyUserID)).data;
            let mappedTracks = compactedTracks.map(function (t) { return "spotify:track:" + t.track.id; });
            await Spotify.addTracksToCompactPlaylist(playlist.href, mappedTracks, localStorage.SpotifyAuthToken);
            console.log("Added tracks to new playlist");
            $scope.loading = false;
            let reduced = compactedTracks.map(t => t.track.duration_ms).reduce((prev, next) => prev + next);

            let newPlaylistMetadata = {
                name: selectedPlaylistName,
                numTracks: compactedTracks.length,
                durationInMin: (reduced / 1000 / 60).toFixed(1)
            };

            $scope.showNewTrackInfo(newPlaylistMetadata);

            let newPlaylistData = (await Spotify.getUserPlaylistData(localStorage.SpotifyAuthToken, localStorage.SpotifyUserID)).data;
            $scope.playlists = newPlaylistData.items;
        }
        catch(ex) {
            showGenericError(ex);
        }
    };

    $scope.showNewTrackInfo = function (newPlaylistMetadata) {
        showMessage("Playlist created!<br><br>" +
        "<b>Name:</b>&nbsp;" + newPlaylistMetadata.name +
        "<br><b>Number of songs:</b>&nbsp;"+newPlaylistMetadata.numTracks+
        "<br><b>Duration:</b>&nbsp;" + newPlaylistMetadata.durationInMin +" [min]");
    };

    console.log("Getting user data...");

    $q.all([
        Spotify.getUserData(localStorage.SpotifyAuthToken),
        Spotify.getUserPlaylistData(localStorage.SpotifyAuthToken, localStorage.SpotifyUserID)
    ])
    .then(async ([userResponse, playlistResponse]) => {
        let response = userResponse.data;
        $scope.user = response;
        let playlistData = playlistResponse.data;
        localStorage.SpotifyUserID = response.id;
        $scope.profilePic = response.images.length ? response.images[0].url : '';
        $('.profilePic').css({
            backgroundImage: "url('" + $scope.profilePic + "')"
        });
        $scope.userName = response.display_name;

        $scope.playlists = playlistData.items;
        $scope.loading = false;
    })
    .catch(ex => {
        console.warn(ex);
        logout();
    });
}])
.controller('needsAuth', function ($scope, $timeout, $location) {
    if (localStorage.SpotifyAuthToken) {
        $timeout(function() {
            $location.path('/main').replace();
            $scope.$apply();
        }, 1);
    }
    $('body').removeClass('loading');
    $("#authButton").off('click').click(function() {
        promptLogin(function(accessToken) {
            localStorage.SpotifyAuthToken = accessToken;
            $location.path('/main').replace();
            $scope.$apply();
        });
    });
});

function showMessage(msg) {
    let d = $.Deferred();
    bootbox.alert({
        message: msg || "",
        className: "compactify-modal",
        backdrop: true,
        buttons: {
            ok: {
                className: 'SpotifyButton'
            }
        },
        callback: function(result) {
            d.resolve(result);
        }
    });
    return d;
}

window.onerror = function(e) {
    showMessage("There was an issue with the application. Please try again later.");
    console.warn(e);
};

function shuffle(a) {
    let j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function compactTracks(tracksList, limit, maxDurationInMilliSec, varianceLevel) {
    let n = limit || 30;
    let pickedSongs = [];
    let durationInMilliseconds = 0;
    let processedIndices = [];
    let processedTracks = 0;
    while (processedTracks < tracksList.length) {
        let index = Math.floor(tracksList.length * Math.random());
        if (processedIndices.includes(index)) continue;
        processedTracks++;
        processedIndices.push(index);
        let candidate = tracksList[index];
        if (pickedSongs.some(ps => ps.track.id === candidate.track.id)) continue;

        let meetsLength = pickedSongs.length < n;
        let meetsDuration = (durationInMilliseconds + candidate.track.duration_ms < maxDurationInMilliSec);
        if ((meetsLength || meetsDuration) !== (meetsLength !== meetsDuration)) {
            durationInMilliseconds += candidate.track.duration_ms;
            if (passesVariance(candidate, tracksList, varianceLevel)) {
                pickedSongs.push(candidate);
            }
        }
        else if (!meetsLength && !meetsDuration) {
            console.log("Breaking after", processedTracks, "songs");
            break;
        }
    }
    //let mappedTracks = pickedSongs.map(function (t) { return "spotify:track:" + t.track.id; });
    return pickedSongs;
}

function passesVariance(song, list, varianceLevel) {
    return true;
}

function promptLogin(callback) {
    let CLIENT_ID = 'ff6b89d12bad4ec2af30b90cd4de045f';
    let REDIRECT_URI = "https://compactify.jmtk.co/#/authorizing/?";
    function getLoginURL(scopes) {
        return 'https://accounts.spotify.com/authorize?client_id=' + CLIENT_ID +
            '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
            '&scope=' + encodeURIComponent(scopes.join(' ')) +
            '&response_type=token';
    }
    let url = getLoginURL([
        'user-read-email',
        'playlist-modify-public',
        'playlist-modify-private',
        'playlist-read-collaborative',
        'playlist-read-private',
        'user-follow-read'
    ]);
    let width = 450,
        height = 730,
        left = (screen.width / 2) - (width / 2),
        top = (screen.height / 2) - (height / 2);

    window.addEventListener("message", function (event) {
        if (event.origin !== window.location.origin) return;
        let hash = JSON.parse(event.data);
        if (hash.type == 'access_token') {
            callback(hash.access_token);
        }
    }, false);

    window.open(url,
        'Spotify',
        'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
    );
}
