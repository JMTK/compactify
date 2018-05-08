(function () {
    'use strict';
    angular
        .module('compactify', ['ngRoute'])
        .config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
            $locationProvider.hashPrefix('');
            $routeProvider
                .when('/main', {
                    templateUrl: 'authSuccess.html',
                    controller: 'success'
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
        }])
        .service('Spotify', Spotify)
        .controller('authorizing', function($scope, $routeParams) {
            var hashToken = $routeParams.accessToken.split("&")[0];
            if (hashToken) {
                console.log(hashToken);
                window.opener.postMessage(JSON.stringify({ type: "access_token", access_token: hashToken }), window.location.origin);
                window.close();
            }
            else {
                showMessage("There was an error processing your request");
            }
        })
        .controller('success', function ($scope, $location, $timeout, Spotify) {
            $('body').addClass('loading');
            var logout = function() {
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

            $(document.body).off('click').on('click', '.playlistLabel input', highlightRow);
            $('#logout').off('click').click(logout);

            console.log("Getting user data...");
            $('#createButton').off('click').click(function() {
                $('body').addClass('loading');
                var selectedPlaylist;
                if ($('.playlists .selectedPlaylist.customURILabel').length) {
                    var uri = $('.customURI').val();
                    var matches = (/spotify:user:([a-zA-Z0-9]+):playlist:([a-zA-Z0-9]{22})/g).exec(uri);
                    if (!matches || matches.length != 3) {
                        $('body').removeClass('loading');
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
                var selectedPlaylistName = $('#playlistName').val();
                var selectedPlaylistSnapshot = $('.playlists input[type=radio]:checked').attr('data-snapshot');
                var deferredItems = [];
                Spotify.getPlaylistTracks(selectedPlaylist, selectedPlaylistSnapshot, localStorage.SpotifyAuthToken)
                    .then(function (allTracks) {
                        //we want to cache by snapshot ID so we don't have to make a bunch of extra requests to spotify later on
                        if (!localStorage["snapshot-" + selectedPlaylistSnapshot]) {
                            //localStorage["snapshot-" + selectedPlaylistSnapshot] = JSON.stringify(allTracks);
                        }

                        var maxDurationCount = parseInt($("#maxDurationCount").val()) || 60;
                        var UOMInMilli = parseInt($("#UOM option:selected").val()) || 60000;
                        var maxDurationInMilliSec = maxDurationCount * UOMInMilli;
                        var userSongLimit = parseInt($('#songLimit').val());
                        var compactedTracks = compactTracks(
                            allTracks,
                            userSongLimit,
                            maxDurationInMilliSec,
                            parseInt($("#varianceLevel").val())
                        );
                        /*console.log("Num songs", compactedTracks.length, "Specified limit", userSongLimit);
                        var reduced = compactedTracks.map(t => t.track.duration_ms).reduce((prev, next) => prev + next);
                        console.log("Duration in minutes", reduced / 1000 / 60, "Specified limit", maxDurationInMilliSec / 1000 / 60);
                        console.log("\n");*/
                        //return;
                        Spotify.createCompactPlaylist(selectedPlaylistName, localStorage.SpotifyAuthToken, localStorage.SpotifyUserID)
                            .then(function(result) {
                                var playlist = result.data;
                                var mappedTracks = compactedTracks.map(function (t) { return "spotify:track:" + t.track.id; });
                                Spotify.addTracksToCompactPlaylist(playlist.href, mappedTracks, localStorage.SpotifyAuthToken)
                                    .then(function () {
                                        $('body').removeClass('loading');
                                        var reduced = compactedTracks
                                                        .map(function(t) {
                                                            return t.track.duration_ms;
                                                        })
                                                        .reduce(function(prev, next) {
                                                            return prev + next;
                                                        });

                                        showMessage("Playlist created!<br><br>" +
                                                    "<b>Name:</b>&nbsp;" + selectedPlaylistName + 
                                                    "<br><b>Number of songs:</b>&nbsp;"+compactedTracks.length+
                                                    "<br><b>Duration:</b>&nbsp;" + (reduced / 1000 / 60).toFixed(1).toString() +" [min]");
                                          Spotify.getUserPlaylistData(localStorage.SpotifyAuthToken, localStorage.SpotifyUserID)
                                            .then(function (result) {
                                                var playlistData = result.data;
                                                $scope.playlists = playlistData.items;
                                                $('body').removeClass('loading');
                                           });
                                    },
                                    function(e) {
                                        console.warn("Error adding tracks to new playlist", e);
                                        showMessage("There was an issue creating your compact playlist");
                                        $('body').removeClass('loading');
                                    });
                            }, function(e) {
                                console.warn("Error creating compact playlist object", e);
                                showMessage("There was an issue creating your compact playlist");
                                $('body').removeClass('loading');
                            });
                    },
                    function(e) {
                        console.warn("Error getting playlist tracks", e);
                        showMessage("There was an issue getting your playlists tracks.");
                        $('body').removeClass('loading');
                    });
            });
            return Spotify.getUserData(localStorage.SpotifyAuthToken)
                .then(function (result) {
                    var response = result.data;

                    localStorage.SpotifyUserID = response.id;
                    $scope.profilePic = response.images.length ? response.images[0].url : '';
                    $('.profilePic').css({
                        backgroundImage: "url('" + $scope.profilePic + "')"
                    });
                    $scope.userName = response.display_name;

                    Spotify.getUserPlaylistData(localStorage.SpotifyAuthToken, localStorage.SpotifyUserID)
                        .then(function (result) {
                            var playlistData = result.data;
                            $scope.playlists = playlistData.items;
                            $('body').removeClass('loading');
                        });
                }, function() {
                    logout();
                });
        })
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
        var d = $.Deferred();
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
        var j, x, i;
        for (i = a.length; i; i--) {
            j = Math.floor(Math.random() * i);
            x = a[i - 1];
            a[i - 1] = a[j];
            a[j] = x;
        }
    }

    function compactTracks(tracksList, limit, maxDurationInMilliSec, varianceLevel) {
        var n = limit || 30;
        shuffle(tracksList);
        var shuffled = tracksList;
        var pickedSongs = [];
        var duration = 0;
        for (var i = 0; i < shuffled.length; i++) {
            var candidate = shuffled[i];
            var meetsLength = pickedSongs.length < n;
            var meetsDuration = (duration + candidate.track.duration_ms < maxDurationInMilliSec);
            if ((meetsLength || meetsDuration) != (meetsLength != meetsDuration)) {
                duration += candidate.track.duration_ms;
                if (passesVariance(candidate, tracksList, varianceLevel)) {
                    pickedSongs.push(candidate);
                }
            }
            else if (!meetsLength && !meetsDuration) {
                console.log("Breaking after", i, "songs");
                break;
            }
        }
        //var mappedTracks = pickedSongs.map(function (t) { return "spotify:track:" + t.track.id; });
        return pickedSongs;
    }

    function passesVariance(song, list, varianceLevel) {
        return true;
    }

    function promptLogin(callback) {
        var CLIENT_ID = 'ff6b89d12bad4ec2af30b90cd4de045f';
        var REDIRECT_URI = "https://compactify.jmtk.co/#/authorizing/?";
        function getLoginURL(scopes) {
            return 'https://accounts.spotify.com/authorize?client_id=' + CLIENT_ID +
                '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
                '&scope=' + encodeURIComponent(scopes.join(' ')) +
                '&response_type=token';
        }
        var url = getLoginURL([
            'user-read-email',
            'playlist-modify-public',
            'playlist-modify-private',
            'playlist-read-collaborative',
            'playlist-read-private'
        ]);
        var width = 450,
            height = 730,
            left = (screen.width / 2) - (width / 2),
            top = (screen.height / 2) - (height / 2);

        window.addEventListener("message", function (event) {
            if (event.origin !== window.location.origin) return;
            var hash = JSON.parse(event.data);
            if (hash.type == 'access_token') {
                callback(hash.access_token);
            }
        }, false);
        var w = window.open(url,
            'Spotify',
            'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
        );
    }

    function highlightRow(event) {
        var el = event.target;

        $('#createButton').removeAttr('disabled').removeAttr('title');
        $('.selectedPlaylist').removeClass('selectedPlaylist');
        var l = $(el).parents('.playlistLabel');
        l.addClass("selectedPlaylist");
        $("#playlistName").val("[Compact] " + ($(l).find('.playlistName').text() || "Custom Playlist"));
    }
})(Spotify);
