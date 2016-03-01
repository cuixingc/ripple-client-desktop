var util = require('util');
var webutil = require('../util/web');
var Tab = require('../client/tab').Tab;
var Currency = ripple.Currency;
var fs = require('fs');

var AssetTab = function ()
{
  Tab.call(this);
};

util.inherits(AssetTab, Tab);

AssetTab.prototype.tabName = 'asset';
AssetTab.prototype.mainMenu = 'asset';

AssetTab.prototype.generateHtml = function () {
    return require('../../templates/tabs/asset.jade')();
};


AssetTab.prototype.angular = function (module) {
    module.controller('AssetCtrl', ['$scope', '$timeout', 'rpId', 'rpNetwork',
            'rpKeychain',
            function($scope, $timeout, $id,
            $network, keychain) {

        if (!$id.loginStatus) $id.goId();
    
        function newAsset() {
			// TODO we should get address of gate from config or others
			//var gatewayd_address = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
			var gatewayd_address = Options.gateway_address;
            var address = $id.account;
            var secret = keychain.requestSecret($id.account);
            
            var data_value = '{"code":"' + $scope.asset_currencycode + '"';
            data_value += ',"name":"' + $scope.asset_currencyname + '"';
            data_value += ',"symbol":"' + $scope.asset_currencysymbol + '"';
            data_value += ',"amount":' + $scope.asset_currencyamount + '}';

			var refDate = new Date(new Date().getTime() + 5 * 60000);
			var amount = ripple.Amount.from_human('' + $scope.asset_currencyamount 
				 + ' XRP', { reference_date: refDate });
			amount.set_issuer(address);

			var tx = $network.remote.transaction();
			// Add memo to tx
			tx.addMemo('TRUSTLINE', '', data_value);
			tx.secret(secret);
			// Destination tag
			//var dt = webutil.getDestTagFromAddress(gatewayd_address);
			//tx.destinationTag(+dt);
			
			tx.payment($id.account, gatewayd_address, amount.to_json());

			tx.on('success', function(res) {
				$scope.onTransactionSuccess(res, tx);
			});

			tx.on('proposed', function(res) {
				$scope.onTransactionProposed(res, tx);
			});

			tx.on('error', function(res) {
				$scope.onTransactionError(res, tx);
			});

			var maxLedger = Options.tx_last_ledger || 3;
			tx.lastLedger($network.remote._ledger_current_index + maxLedger);
			tx.submit();
        };

        $scope.$watch('asset_currencycode', function() {
            //$scope.asset_currencycode = '';
        });

        // clear data
        $scope.reset = function() {
			$scope.mode = "form";
            $scope.asset_currencycode = '';
            $scope.asset_currencyname = '';
            $scope.asset_currencyamount = ''; 
            $scope.asset_currencysymbol = '';
        };

        $scope.toggle_form = function() {
            $scope.reset();
        };
        
        $scope.grant = function() {

            $scope.$apply(function() {
                //$scope.verifying = false;

                $scope.confirm_wait = true;
                $timeout(function() {
                    $scope.confirm_wait = false;
                }, 1000, true);
            });
        };

        $scope.grant_confirmed = function() {
            newAsset();
        };

		$scope.onTransactionSuccess = function (res, tx) {
		  $scope.$apply(function () {
			$scope.setEngineStatus(res, true);
		  });
		};

		$scope.onTransactionProposed = function(res, tx) {
		  $scope.$apply(function() {
			  $scope.setEngineStatus(res, false);
			  $scope.sent(tx.hash);
		  });
		};

		$scope.onTransactionError = function (res, tx) {
		  setImmediate(function () {
			  $scope.$apply(function () {
				  $scope.mode = "error";

				  if (res.engine_result) {
					$scope.setEngineStatus(res);
				  } else if (res.error === 'remoteError') {
					$scope.error_type = res.remote.error;
				  } else {
					$scope.error_type = "unknown";
				  }
				});
			  });
		};


		$scope.setEngineStatus = function(res, accepted) {
		  $scope.engine_result = res.engine_result;
		  $scope.engine_result_message = res.engine_result_message;
		  $scope.engine_status_accepted = !!accepted;
		  $scope.mode = "status";
		  $scope.tx_result = "partial";
		  switch (res.engine_result.slice(0, 3)) {
			case 'tes':
			  $scope.mode = "status";
			  $scope.tx_result = accepted ? "cleared" : "pending";
			  break;
			case 'tep':
			  $scope.mode = "status";
			  $scope.tx_result = "partial";
			  break;
			default:
			  $scope.mode = "rippleerror";
		  } 
		};

		$scope.sent = function (hash) {                                                                      
		  $scope.mode = "status";                                                                            
		  $network.remote.on('transaction', handleAccountEvent);                                             

		  function handleAccountEvent(e) {                                                                   
			$scope.$apply(function () {                                                                      
				if (e.transaction.hash === hash) {                                                             
				  $scope.setEngineStatus(e, true);                                                             
				  $network.remote.removeListener('transaction', handleAccountEvent);                           
				}                                                                                              
				});                                                                                              
		  }                                                                                                  
		};  

		$scope.reset_goto = function (tabName) {
		  $scope.reset();

		  // TODO do something clever instead of document.location
		  // because goToTab does $scope.$digest() which we don't need
		  document.location = '#' + tabName;
		};
        
		$scope.reset();
    }]);
};

module.exports = AssetTab;
