import React from "react";
import { LucideIcon } from "lucide-react";

interface Service {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  link: string;
}

interface ServiceBoxProps {
  service: Service;
  onClick: (service: Service) => void;
}

const ServiceBox: React.FC<ServiceBoxProps> = ({ service, onClick }) => (
  <div
    className="group relative flex flex-col items-center justify-center p-6 border rounded-lg shadow-sm transition-all duration-300 ease-in-out bg-card text-card-foreground cursor-pointer hover:shadow-md transform hover:scale-105"
    onClick={() => onClick(service)}
  >
    <div className="absolute rounded-lg inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300 ease-in-out blur-sm"></div>
    </div>
    <service.icon className="w-8 h-8 mb-4 text-green-400 transition-colors duration-300 ease-in-out  relative" />
    <h3 className="text-lg text-center font-semibold mb-2 relative">{service.name}</h3>
    <p className="text-sm text-muted-foreground text-center relative">
      {service.description}
    </p>
  </div>
);

export default ServiceBox;