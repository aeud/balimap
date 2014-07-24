var mapApp = angular.module('mapApp', ['ui.date', 'ui.slider']);
 
mapApp.controller('MapCtrl', function ($scope, $http, $templateCache) {
	$scope.filters = {
		'features': []
	};
	$scope.dateOptionsFrom = {};
	var date = new Date('2014-01-01'); date.setDate(date.getDate() + 15);
	$scope.from = date;
	$scope.nights = 4;
	$scope.rooms = 4;
	$scope.budget = [200, 800];
	$scope.minprice = 100;
	$scope.maxprice = 1000;
	$scope.data = null;
	var markers = {};
	
	$scope.sliderOptions = {
		orientation: 'horizontal',
		min: $scope.minprice,
		max: $scope.maxprice,
		range: true,
		values: $scope.budget,
		change: search,
		step: 10
	}
	
	$scope.filters.features = {};
	
	function setVilla(idStr) {
		$http({
			method: 'jsonp',
			url: 'http://localhost/Symfony/srilanka-villa.com/web/app_dev.php/api/map/'+idStr+'?callback=JSON_CALLBACK',
		}).success(function(data){
			$scope.villa = data
		})
	}
	setVilla('villa-santi');

	$scope.villa = null;
	function addInfo(marker, info) {
		google.maps.event.addListener(marker, 'click', function() {
			$scope.villa = null;
			map.setZoom(14);
			map.setCenter(marker.getPosition());
			setVilla(info);
			
		});
		var contentString = '<div id="content">'+
		      '<div id="siteNotice">'+
		      '</div>'+
		      '<h1 id="firstHeading" class="firstHeading">'+info+'</h1>'+
		      '<div id="bodyContent">'+
		      '</div>'+
		      '</div>';

		var infowindow = new google.maps.InfoWindow({
			content: contentString
		});
		
		google.maps.event.addListener(marker, 'mouseover', function() {
			infowindow.open(map,marker);
		});
		google.maps.event.addListener(marker, 'mouseout', function() {
			infowindow.close();
		});
	}
	function test(test) { console.log('test'); }
	$scope.search = function(){ search() }
	function search() {
		if ($scope.from && $scope.nights && $scope.rooms && $scope.budget) {
			var arraymarkers = _.values(markers);
			for (var i = 0; i < arraymarkers.length; i++) {
				arraymarkers[i].setMap(null);
			}
			var query = {
				'query': {
					'bool': {
						'must': []
					}
				},
				'fields': ['name', 'id_str', 'position'],
				'size': 500,
				'facets': {
					'features': {
						'terms': {
							'field': 'features',
							'size': 10
						} 
					},
					'rooms': {
						'terms': {
							'field': 'rooms',
							'size': 10
						} 
					}
				}
			}
			query.query.bool.must.push({
				'nested': {
					'path': 'confs',
					'query': {
						'bool': {
							'must': [
								{
									'match': {
										'conf_rooms': $scope.rooms
									}
								},
								{
									'match': {
										'conf_date': $scope.from.toISOString().slice(0,10)
									}
								},
								{
									'match': {
										'conf_nights': $scope.nights
									}
								},
								{
									'range': {
										'conf_price': {
											'gte': $scope.nights * $scope.budget[0],
											'lte': $scope.nights * $scope.budget[1]
										}
									}
								}
							]
						}
					}
				}
			});
			var must_not = [];
			if ($scope.from) {
				function addDate(dates, date) {
					dates.push(date.toISOString().slice(0,10));
					return dates;
				}
				var from = new Date($scope.from); from.setDate(from.getDate() + 1) // !!
				var dates = [];
				for (var i = 0; i < $scope.nights; i++) {
					dates = addDate(dates, from)
					from.setDate(from.getDate() + 1);
				}
				must_not.push({
					'terms': {
						'availability_unavailable': dates,
						'minimum_should_match': 1
					}
				});
			}
			if (must_not.length > 0) query.query.bool.must_not = must_not;
			var filter = { 'and': [] };
			var filterFeaturesKeys = _.keys($scope.filters.features);
			if (filterFeaturesKeys.length > 0) {
				/*
				filter.and.push({
					'terms': {
						'features': filterFeaturesKeys,
					    'execution' : 'and',
	                   '_cache': true
					}
				});
				*/
				query.query.bool.must.push({
					'terms': {
						'features': filterFeaturesKeys,
					    'minimum_should_match': filterFeaturesKeys.length
					}
				});
			}
			if (filter.and.length > 0) {
				query.filter = filter;
			}
			console.log(query)
			$scope.query = query;
			$http({
				method: 'post',
				url: 'http://localhost:9200/united/_search',
				cache: $templateCache,
				responseType: 'json',
				data: JSON.stringify(query)
			}).success(function(data){
				//console.log(data)
				$scope.data = data;
				if (hits = data.hits.hits) {
					for (var i = 0; i < hits.length; i++) {
						var coordinates = hits[i].fields.position;
						if (markers[hits[i].fields.id_str]) {
							markers[hits[i].fields.id_str].setMap(map);
						} else {
							var marker = new google.maps.Marker({
								position: new google.maps.LatLng(coordinates[1], coordinates[0]),
								map: map
							});
							var name = hits[i].fields.id_str;
							markers[hits[i].fields.id_str] = marker;
							addInfo(marker, name)
						}
					}
				}
				$scope.features = data.facets.features;
			})
		}
	}
	$scope.updateFilters = function () {
		var filterFeaturesKeys = _.keys($scope.filters.features);
		for (var i = 0; i < filterFeaturesKeys.length; i++) {
			if (!$scope.filters.features[filterFeaturesKeys[i]]) delete $scope.filters.features[filterFeaturesKeys[i]];
		}
		search();
	}
	$scope.deleteFilter = function (type, index) {
		$scope.filters[type].splice(index, 1);
		search();
	}
	search();
	
});