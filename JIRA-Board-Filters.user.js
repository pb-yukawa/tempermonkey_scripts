// ==UserScript==
// @name         JIRA-Board:Extra Filters
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Filters JIRA ticket
// @author       Masahiro Yukawa
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    var jiraw = jiraw || {};
    jiraw.selectors = {
        backlog: {
            tickets: ".js-issue",
            images: ".ghx-issue-content .ghx-avatar-img",
            extra: ".ghx-extra-field",
            selectParent: "#ghx-controls-plan"
        },
        kanban: {
            tickets: ".js-detailview",
            images: ".ghx-avatar-img",
            extra: ".ghx-extra-field",
            selectParent: ".ghx-controls-work"
        }
    };
    var META_ALL = "@@@All@@@";

    $(".aui-nav .aui-nav-item").on("click", display);
    display();

    function display() {
        setTimeout(function() {
            new FiltersBuilder(jiraw.selectors[!!document.URL.match(/view=planning/) ? "backlog" : "kanban"])
                .addFilterByImage("担当", /^(担当者|Assignee): /)
                .addFilterByExtraField("バージョン", /^(修正バージョン|Version): /)
                .addFilterByExtraField("エピック", /^(エピック|Epic): /)
                .build();
        }, 2500);
    }

    function FiltersBuilder(env) {
        this.env = env;
        this.filters = [];
        this.index = 0;
        this.builder = this;

        this.addFilterByImage = function(name, patternRegex) {
            var that = this;
            this.addFilter(name, patternRegex, function(keySet) {
                $(that.env.images).each(function() {
                    var key = this.alt.replace(patternRegex, "");
                    if (keySet.indexOf(key) < 0) {
                        keySet.push(key);
                    }
                });
            }, function($tickets) {
                var $select = $("." + this.class);
                var key = $select.val();
                if (key === META_ALL) {
                    return $tickets;
                }
                if (key === "None") {
                    return $tickets.filter(function() { return !$(this).find(that.env.images).length; });
                }
                return $tickets.filter(function() {
                    var $image = $(this).find(that.env.images).first();
                    if (!$image.length) {
                        return false;
                    }
                    return $image[0].alt.replace(patternRegex, "") === key;
                });
            });
            return this;
        };

        this.addFilterByExtraField = function(name, patternRegex) {
            var that = this;
            this.addFilter(name, patternRegex, function(keySet) {
                $(that.env.extra).each(function() {
                    var tooltip = $(this).data("tooltip");
                    if (tooltip.match(patternRegex)) {
                        var key = tooltip.replace(patternRegex, "");
                        if (keySet.indexOf(key) < 0) {
                            keySet.push(key);
                        }
                    }
                });
            }, function($tickets) {
                var $select = $("." + this.class);
                var key = $select.val();
                if (key === META_ALL) {
                    return $tickets;
                }
                return $tickets.filter(function() {
                    var $e = $(this).find(that.env.extra).filter(function() {
                        var tooltip = $(this).data("tooltip");
                        return !!tooltip && tooltip.match(patternRegex);
                    });
                    if (!$e || !$e.length) {
                        // 対象のフィールドでない場合は据え置き
                        return true;
                    }
                    if ($e.data("tooltip").replace(patternRegex, "") === key) {
                        return true;
                    }
                    return false;
                });
            });
            return this;
        };

        this.addFilter = function(name, patternRegex, createKeySetFunc, filterFunc) {
            var that = this;
            var targetClass = "jira-filter-" + that.index++;
            $("." + targetClass).remove();
            var keySet = [];

            createKeySetFunc(keySet);

            if (!keySet.length) {
                return that;
            }
            keySet.sort();

            that.filters.push({
                name: name,
                class: targetClass,
                regex: patternRegex,
                keySet: keySet,
                filter: filterFunc
            });
            return that;
        };

        this.build = function() {
            var that = this;
            var $refilter = $("<span></span>", {
                text: "Refilter",
                class: "aui-icon aui-icon-small aui-iconfont-refresh-small"
            });
            $refilter.on("click", function() {
                that.filter();
            });
            $refilter.appendTo(that.env.selectParent);
            that.filters.forEach(function(e) {
                var $select = $("<select></select>", {
                    class: e.class + " select"
                }).append($("<option></option>", {
                    text: e.name + " - All",
                    value: META_ALL
                })).append($("<option></option>", {
                    text: "None",
                    value: "None"
                }));
                $.each(e.keySet, function(i, key) {
                    $("<option></option>", {
                        text: key.replace(e.regex, ""),
                        value: key
                    }).appendTo($select);
                });
                var $form = $("<form></form>", {
                    class: "aui"
                });
                $select.appendTo($form);
                $form.appendTo(that.env.selectParent);
                $select.on("change", function() {
                    that.filter();
                });
            });
        };

        this.filter = function(key) {
            var that = this;
            if (!that.filters.length) {
                $(that.env.tickets).show();
                return;
            }
            var $tickets = that.filters.reduce(function($ts, f) {
                return !!$ts && !!$ts.length ? f.filter($ts) : null;
            }, $(that.env.tickets));
            $(that.env.tickets).hide();
            if (!!$tickets) {
                $tickets.show();
            }
        };

        return this;
    }
})();