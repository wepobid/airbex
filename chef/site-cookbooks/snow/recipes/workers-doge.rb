workercrypto "workers-doge" do
    cryptoName  "dogecoin"
    cryptoCode "DOGE"
    workerDir "#{node[:snow][:workers][:app_directory]}-doge"
    minConf 6
end
